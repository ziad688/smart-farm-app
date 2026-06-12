import React, { useState, useEffect } from 'react';
import { Upload, Search, ShieldAlert, CheckCircle2, AlertTriangle, Loader2, HardDrive } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import useDrivePicker from 'react-google-drive-picker';

export default function DiseaseDetectionView() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [activeHoverBox, setActiveHoverBox] = useState(null);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState(null);

  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [openPicker, authRes] = useDrivePicker();
  const authResRef = React.useRef(null);

  useEffect(() => {
    if (authRes) {
      authResRef.current = authRes;
    }
  }, [authRes]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
        setResult(null);
        setError(null);
        setShowUploadOptions(false);
        setImgNaturalSize({ width: 0, height: 0 });
        setActiveHoverBox(null);
        setSelectedBoxIndex(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDriveSelect = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const developerKey = import.meta.env.VITE_GOOGLE_API_KEY;

    if (!clientId || !developerKey) {
      setError("Google Drive API keys are not configured. Please set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY.");
      setShowUploadOptions(false);
      return;
    }

    // Intercept Google Identity Services token client callback to grab the token 100% reliably
    try {
      if (window.google?.accounts?.oauth2 && !window.google.accounts.oauth2._isInterceptedByApp) {
        const originalInitToken = window.google.accounts.oauth2.initTokenClient;
        window.google.accounts.oauth2.initTokenClient = function (config) {
          const originalCallback = config.callback;
          config.callback = function (tokenResponse) {
            console.log("Captured TokenResponse from interceptor:", tokenResponse);
            if (tokenResponse?.access_token) {
              window.lastGoogleOAuthToken = tokenResponse.access_token;
              if (authResRef) {
                authResRef.current = tokenResponse;
              }
            }
            if (originalCallback) originalCallback(tokenResponse);
          };
          return originalInitToken.call(window.google.accounts.oauth2, config);
        };
        window.google.accounts.oauth2._isInterceptedByApp = true;
      }
    } catch (e) {
      console.error("Failed to inject token response interceptor:", e);
    }

    openPicker({
      clientId,
      developerKey,
      viewId: "DOCS_IMAGES",
      customScopes: ["https://www.googleapis.com/auth/drive.file"],
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: false,
      callbackFunction: async (data) => {
        if (data.action === 'picked') {
          const file = data.docs[0];
          const fileId = file.id;
          const oauthToken = authResRef.current?.access_token || data.oauthToken || window.lastGoogleOAuthToken;
          
          console.log("Picked from Google Drive. Doc:", file, "Token present:", !!oauthToken, "Raw ref token:", authResRef.current?.access_token);

          if (oauthToken) {
            setIsAnalyzing(true);
            setError(null);
            try {
              let response;
              
              // Method A: Client-side direct fetch (best performance and avoids node backend payload/size limits)
              try {
                console.log("Attempting direct client-side fetch from Google Drive APIs...");
                response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                  headers: {
                    Authorization: `Bearer ${oauthToken}`
                  }
                });
              } catch (clientErr) {
                console.warn("Client-side download error (CORS or network). Falling back to backend proxy...", clientErr);
              }

              // Method B: Backend Proxy fallback
              if (!response || !response.ok) {
                console.log("Attempting backend server-side fetch from Google Drive APIs...");
                response = await fetch('/api/proxy-drive', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileId, oauthToken })
                });
              }

              if (!response.ok) {
                let proxyErrorMsg = "Failed to fetch file context";
                try {
                  const errData = await response.json();
                  proxyErrorMsg = errData.error || proxyErrorMsg;
                } catch (_) {}
                throw new Error(proxyErrorMsg);
              }

              let base64Url;
              // Check if response returned JSON (the backend proxy) or raw blob (direct fetch)
              const contentTypeHeader = response.headers.get('content-type') || "";
              if (contentTypeHeader.includes('application/json')) {
                const resBody = await response.json();
                if (resBody.error) {
                  throw new Error(resBody.error);
                }
                base64Url = `data:${resBody.contentType};base64,${resBody.base64}`;
              } else {
                const blob = await response.blob();
                base64Url = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              }

              setSelectedImage(base64Url);
              setResult(null);
              setError(null);
              setShowUploadOptions(false);
              setImgNaturalSize({ width: 0, height: 0 });
              setActiveHoverBox(null);
              setSelectedBoxIndex(null);
            } catch (err) {
              console.error("Both direct and proxy Google Drive file downloads failed:", err);
              
              // Fallback Method C: Try downloading the thumbnail URL if available.
              // Fast & bypasses Google Drive API restriction because it's on static servers.
              if (file.thumbnailUrl) {
                console.log("Attempting Method C: Proxying file.thumbnailUrl as fallback...", file.thumbnailUrl);
                try {
                  // Some thumbnail URLs have '=s220' at the end. We can change it to '=s800' to try to get a larger size!
                  let thumbUrl = file.thumbnailUrl;
                  if (thumbUrl.includes('=s220')) {
                    thumbUrl = thumbUrl.replace('=s220', '=s800');
                  }
                  
                  const fallbackRes = await fetch('/api/proxy-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: thumbUrl })
                  });
                  
                  if (fallbackRes.ok) {
                    const resBody = await fallbackRes.json();
                    if (resBody.base64) {
                      const base64Url = `data:${resBody.contentType};base64,${resBody.base64}`;
                      setSelectedImage(base64Url);
                      setResult(null);
                      setError(null);
                      setShowUploadOptions(false);
                      setImgNaturalSize({ width: 0, height: 0 });
                      setActiveHoverBox(null);
                      setSelectedBoxIndex(null);
                      console.log("Method C Fallback Succeeded: Thumbnail loaded.");
                      return; // Success! Skip setting error
                    }
                  }
                } catch (fallbackErr) {
                  console.error("Method C Fallback also failed:", fallbackErr);
                }
              }

              // Provide a clear explanation to the user instead of resolving to a broken image url
              setError(`Could not fetch the image from Google Drive: ${err.message}. Please verify the file is an image and you have appropriate permissions.`);
            } finally {
              setIsAnalyzing(false);
            }
          } else {
            setError("Google Drive authorization failed. No active OAuth access token was retrieved.");
          }
        }
      },
    });
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;
    
    setIsAnalyzing(true);
    setError(null);
    try {
      let base64Data = "";
      let mimeType = "image/jpeg";

      if (selectedImage.startsWith('data:')) {
        // Local file already in base64
        const parts = selectedImage.split(',');
        base64Data = parts[1];
        mimeType = parts[0].split(':')[1].split(';')[0];
      } else {
        // External URL (e.g. Google Drive), fetch via proxy
        const proxyRes = await fetch('/api/proxy-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: selectedImage })
        });
        
        if (!proxyRes.ok) throw new Error("Failed to fetch image from Drive");
        const proxyData = await proxyRes.json();
        base64Data = proxyData.base64;
        mimeType = proxyData.contentType;
      }

      // Call the local backend which proxies to Roboflow
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data, mimeType })
      });

      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json();
        throw new Error(errData.error || "Analysis failed");
      }

      const roboflowData = await analyzeRes.json();
      console.log("Roboflow Data:", roboflowData);

      // Process Roboflow predictions
      let finalResult;
      if (roboflowData.predictions && roboflowData.predictions.length > 0) {
        // Sort by confidence and take the top one
        const topPrediction = [...roboflowData.predictions].sort((a, b) => b.confidence - a.confidence)[0];
        const info = getRecommendation(topPrediction.class);
        
        finalResult = {
          diseaseName: topPrediction.class,
          confidence: `${(topPrediction.confidence * 100).toFixed(1)}%`,
          description: info.description,
          recommendations: info.actions,
          predictions: roboflowData.predictions, // Save all predictions for drawing
          imageInfo: roboflowData.image || null  // Save image dimensions if returned by Roboflow
        };
      } else {
        const info = getRecommendation("healthy");
        finalResult = {
          diseaseName: "Healthy",
          confidence: "99.9%",
          description: info.description,
          recommendations: info.actions,
          predictions: [],
          imageInfo: null
        };
      }

      setResult(finalResult);

      // Save to local gallery (Running Local)
      try {
        await fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: selectedImage,
            category: 'Diagnosis',
            disease: finalResult.diseaseName,
            confidence: finalResult.confidence
          })
        });
      } catch (saveErr) {
        console.warn("Failed to save diagnosis to gallery:", saveErr);
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRecommendation = (disease) => {
    const normalizedDisease = disease.toLowerCase().trim();
    
    // Detailed disease information
    const diseaseData = {
      'leaf spot': {
        description: "Leaf spot is a common fungal disease caused by Mycosphaerella fragariae. It appears as small, circular, deep purple spots on the upper leaf surfaces. As the spots enlarge, the centers turn light brown or gray, and finally white.",
        actions: [
          "Remove and destroy all infected leaves to reduce spore count.",
          "Apply a copper-based fungicide or Myclobutanil during early spring.",
          "Switch to drip irrigation to keep foliage dry.",
          "Ensure proper spacing between plants for maximum air circulation.",
          "Avoid excessive nitrogen fertilization which promotes lush, susceptible growth."
        ]
      },
      'gray mold': {
        description: "Gray mold (Botrytis cinerea) is one of the most serious diseases of strawberries. It affects the fruit at any stage of development. Infected berries develop a soft, brown rot that quickly becomes covered with a fuzzy gray mass of spores.",
        actions: [
          "Remove and destroy all infected fruit immediately (do not compost).",
          "Apply a layer of clean straw mulch to keep berries from touching the soil.",
          "Improve air circulation by thinning plants or removing weeds.",
          "Harvest fruit frequently and handle gently to avoid bruising.",
          "Apply preventative bio-fungicides during the bloom period."
        ]
      },
      'powdery mildew': {
        description: "Powdery mildew is caused by the fungus Podosphaera aphanis. It primarily affects the leaves, causing them to curl upward. A white, powdery fungal growth may be visible on the undersides of the leaves.",
        actions: [
          "Apply sulfur or potassium bicarbonate sprays at the first sign of infection.",
          "Increase sunlight exposure by thinning the canopy.",
          "Avoid overhead watering, especially in the evening.",
          "Plant resistant varieties in areas prone to high humidity.",
          "Monitor plants closely during warm, humid weather."
        ]
      },
      'anthracnose fruit rot': {
        description: "Anthracnose is a devastating disease caused by Colletotrichum species. It causes firm, sunken, circular, dark brown to black lesions on the fruit. In humid conditions, salmon-colored spore masses may appear in the center of the lesions.",
        actions: [
          "Immediately remove and destroy all infected fruit and runners.",
          "Apply fungicides containing captan, fludioxonil, or azoxystrobin.",
          "Strictly avoid overhead irrigation; water only at the base of the plant.",
          "Mulch with plastic or straw to prevent soil splashing onto the fruit.",
          "Clean all tools and boots after working in an infected area."
        ]
      },
      'angular leaf spot': {
        description: "Angular leaf spot is a bacterial disease caused by Xanthomonas fragariae. It is characterized by small, water-soaked lesions on the lower leaf surface, which are delimited by small veins, giving them an angular appearance.",
        actions: [
          "Avoid working in the field when plants are wet with dew or rain.",
          "Apply copper-based sprays to protect healthy tissue (use with caution to avoid phytotoxicity).",
          "Remove old, infected foliage during the dormant season.",
          "Ensure plants are not overcrowded.",
          "Avoid overhead irrigation during periods of high humidity."
        ]
      },
      'verticillium wilt': {
        description: "Verticillium wilt is a soil-borne fungal disease that attacks the root system. The first symptoms are often the wilting and dying of the outer, older leaves, while the inner leaves remain green but stunted.",
        actions: [
          "Remove and destroy infected plants, including the root system.",
          "Do not replant strawberries in the same spot for at least 3-5 years.",
          "Improve soil drainage and avoid overwatering.",
          "Rotate crops with non-susceptible plants like corn or small grains.",
          "Plant certified disease-free and resistant varieties."
        ]
      },
      'healthy': {
        description: "Your strawberry plant appears to be in excellent health! There are no visible signs of fungal or bacterial infection. The leaves are vibrant, and the structure is strong.",
        actions: [
          "Continue regular watering at the base of the plant (1 inch per week).",
          "Apply a balanced organic fertilizer during the growing season.",
          "Monitor for pests like aphids or spider mites.",
          "Keep the area free of weeds to reduce competition for nutrients.",
          "Ensure berries are harvested as soon as they are ripe."
        ]
      },
      'default': {
        description: "We have detected signs of stress or potential disease that doesn't perfectly match our primary database. This could be a nutritional deficiency, environmental stress, or a less common pathogen.",
        actions: [
          "Take a sample to your local agricultural extension office for professional diagnosis.",
          "Check soil pH and nutrient levels (strawberries prefer pH 5.5 to 6.5).",
          "Inspect the undersides of leaves for tiny pests.",
          "Review your watering schedule to ensure the soil is moist but not waterlogged.",
          "Avoid applying any chemicals until a definitive diagnosis is made."
        ]
      }
    };
    
    // Check for exact match
    if (diseaseData[normalizedDisease]) {
      return diseaseData[normalizedDisease];
    }

    // Partial matches
    if (normalizedDisease.includes('anthracnose')) return diseaseData['anthracnose fruit rot'];
    if (normalizedDisease.includes('mold')) return diseaseData['gray mold'];
    if (normalizedDisease.includes('spot')) return diseaseData['leaf spot'];
    if (normalizedDisease.includes('mildew')) return diseaseData['powdery mildew'];
    if (normalizedDisease.includes('healthy')) return diseaseData['healthy'];

    return diseaseData['default'];
  };

  const renderErrorContent = (msg) => {
    if (!msg) return null;
    if (typeof msg !== 'string') return String(msg);

    // Look for Google Console activation links (drive.googleapis.com)
    const urlRegex = /(https?:\/\/console\.[^\s'"\}]+)/g;
    const urls = msg.match(urlRegex);

    if (urls && msg.toLowerCase().includes("drive.googleapis.com")) {
      const cleanUrl = urls[0].replace(/[.,;:})]+$/, "");
      return (
        <div className="space-y-4 w-full">
          <div className="font-bold flex items-center gap-1.5 text-rose-700">
            <span>Google Drive API is Disabled</span>
          </div>
          <p className="text-sm leading-relaxed text-rose-600/90">
            To query files from Google Drive, Google requires enabling the <strong>Google Drive API</strong> in your Cloud project console.
          </p>
          <div className="pt-1">
            <a
              href={cleanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition-all text-center uppercase tracking-wider"
            >
              <span>Enable Google Drive API</span>
              <span className="text-[10px]">↗</span>
            </a>
          </div>
          <div className="space-y-1.5 text-xs text-rose-500/90 leading-normal border-t border-rose-500/10 pt-3">
            <p className="font-semibold text-rose-600">Steps to fix:</p>
            <ol className="list-decimal pl-4 space-y-1 text-rose-500/80">
              <li>Click the bold button above to visit your Google Cloud Console</li>
              <li>Toggle/click the blue <strong>"Enable"</strong> button on that page</li>
              <li>Return here, wait 30 seconds for propagation, and select the file again!</li>
            </ol>
          </div>
        </div>
      );
    }
    return msg;
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      <header>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Disease Detection</h2>
        <p className="text-sm text-muted-foreground mt-1">AI-powered diagnostic tool for strawberry health</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className={cn(
            "border-2 border-dashed rounded-3xl flex flex-col items-center justify-center relative bg-muted/50 transition-all",
            selectedImage ? "border-emerald-500/30 p-2 bg-slate-900/5 dark:bg-slate-900/10" : "border-border aspect-square"
          )}>
            {selectedImage ? (
              <div 
                className="relative inline-block max-w-full overflow-hidden rounded-2xl mx-auto align-middle cursor-default"
                onClick={() => setSelectedBoxIndex(null)}
              >
                <img 
                  src={selectedImage} 
                  alt="Selected Strawberry leaf" 
                  onLoad={(e) => {
                    setImgNaturalSize({
                      width: e.target.naturalWidth,
                      height: e.target.naturalHeight
                    });
                  }}
                  className="max-h-[500px] w-auto max-w-full rounded-2xl block object-contain mx-auto" 
                  referrerPolicy="no-referrer" 
                />
                
                {/* Bounding boxes layer */}
                {result && result.predictions && result.predictions.map((pred, idx) => {
                  const originalWidth = result.imageInfo?.width || imgNaturalSize.width || 1;
                  const originalHeight = result.imageInfo?.height || imgNaturalSize.height || 1;

                  const left = ((pred.x - pred.width / 2) / originalWidth) * 100;
                  const top = ((pred.y - pred.height / 2) / originalHeight) * 100;
                  const w = (pred.width / originalWidth) * 100;
                  const h = (pred.height / originalHeight) * 100;

                  const isHovered = activeHoverBox === idx;
                  const isSelected = selectedBoxIndex === idx;
                  const isHighlighted = isHovered || isSelected;

                  return (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1,
                        borderColor: isHighlighted ? "#ef4444" : "#f43f5e",
                        backgroundColor: isHighlighted ? "rgba(239, 68, 68, 0.35)" : "rgba(244, 63, 94, 0.15)",
                        boxShadow: isHighlighted ? "0 0 20px rgba(239, 68, 68, 0.8), inset 0 0 8px rgba(239, 68, 68, 0.2)" : "0 0 12px rgba(244, 63, 94, 0.4)",
                        zIndex: isHighlighted ? 30 : 10
                      }}
                      className="absolute border-2 rounded-xl transition-all pointer-events-auto cursor-pointer flex items-start justify-start"
                      onMouseEnter={() => setActiveHoverBox(idx)}
                      onMouseLeave={() => setActiveHoverBox(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBoxIndex(prev => prev === idx ? null : idx);
                      }}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${w}%`,
                        height: `${h}%`,
                      }}
                    >
                      <div className={cn(
                        "absolute top-0 left-0 text-white text-[9px] md:text-xs font-mono px-1.5 py-0.5 whitespace-nowrap font-semibold select-none flex items-center gap-1 rounded-tl-[10px] rounded-br-[6px] transition-colors pointer-events-none",
                        isHighlighted ? "bg-rose-600 scale-105 origin-top-left font-bold" : "bg-rose-500/85"
                      )}>
                        <span className="capitalize">{pred.class}</span>
                        <span className="opacity-90 bg-black/25 px-1 py-0.1 rounded text-[8px] md:text-[10px]">
                          {(pred.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </motion.div>
                  );
                })}

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(null);
                    setResult(null);
                    setError(null);
                    setImgNaturalSize({ width: 0, height: 0 });
                    setActiveHoverBox(null);
                    setSelectedBoxIndex(null);
                  }}
                  className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors z-30 shadow-lg"
                  title="Remove image"
                >
                  <Search className="rotate-45" size={20} />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center space-y-4 p-12 text-center">
                <div className="p-6 bg-emerald-500/10 rounded-full text-emerald-600">
                  <Upload size={48} />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <p className="font-semibold text-lg">Upload Strawberry Photo</p>
                  <p className="text-sm text-muted-foreground mt-1">Take a clear photo of the leaves or fruit</p>
                  
                  <div className="mt-4 w-full max-w-xs">
                    {!showUploadOptions ? (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          setShowUploadOptions(true);
                        }}
                        className="w-full px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Upload size={20} />
                        Upload Photo
                      </button>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col gap-2"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <label className="cursor-pointer px-4 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-2 hover:bg-emerald-600 transition-colors">
                            <Upload size={18} />
                            Local File
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                          </label>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              handleDriveSelect();
                            }}
                            className="px-4 py-3 bg-blue-500 text-white rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                          >
                            <HardDrive size={18} />
                            Google Drive
                          </button>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            setShowUploadOptions(false);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                        >
                          Cancel
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </label>
            )}
          </div>

          <button
            onClick={analyzeImage}
            disabled={!selectedImage || isAnalyzing}
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all",
              selectedImage && !isAnalyzing 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Search size={24} />
                Start Diagnosis
              </>
            )}
          </button>
        </div>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 flex items-start gap-3 text-rose-600 w-full"
              >
                <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                <div className="text-sm font-medium w-full">{renderErrorContent(error)}</div>
              </motion.div>
            )}

            {isAnalyzing && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-emerald-500/30 rounded-3xl bg-emerald-500/5"
              >
                <div className="p-6 bg-emerald-500/10 rounded-full text-emerald-600 mb-4">
                  <Loader2 className="animate-spin" size={48} />
                </div>
                <h3 className="font-semibold text-xl">Analyzing Strawberry...</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                  Our AI is examining the plant for signs of disease. This usually takes a few seconds.
                </p>
              </motion.div>
            )}

            {result && !isAnalyzing ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-3xl p-8 shadow-sm space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-2xl",
                    result.diseaseName.toLowerCase().includes('healthy') ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                  )}>
                    {result.diseaseName.toLowerCase().includes('healthy') ? <CheckCircle2 size={32} /> : <ShieldAlert size={32} />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold capitalize">{result.diseaseName}</h3>
                    <p className="text-sm text-muted-foreground font-medium">Confidence Score: {result.confidence}</p>
                    
                    {result.predictions && result.predictions.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block mb-2">
                          Detected Anomalies ({result.predictions.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {result.predictions.map((p, idx) => {
                            const isSelected = selectedBoxIndex === idx;
                            const isHovered = activeHoverBox === idx;
                            const isHighlighted = isHovered || isSelected;

                            return (
                              <button
                                key={idx}
                                onMouseEnter={() => setActiveHoverBox(idx)}
                                onMouseLeave={() => setActiveHoverBox(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBoxIndex(prev => prev === idx ? null : idx);
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                                  isHighlighted 
                                    ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20 scale-105" 
                                    : "bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400"
                                )}
                              >
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full transition-colors", 
                                  isHighlighted ? "bg-white" : "bg-rose-500"
                                )} />
                                <span className="capitalize">{p.class}</span>
                                <span className="opacity-80">{(p.confidence * 100).toFixed(0)}%</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Disease Description</h4>
                    <p className="text-foreground leading-relaxed">{result.description}</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Recommended Actions</h4>
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6 space-y-4">
                      {result.recommendations && result.recommendations.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <p className="text-sm text-foreground/90 leading-relaxed">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : !error && !isAnalyzing && (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-border rounded-3xl bg-muted/20"
              >
                <div className="p-6 bg-muted rounded-full text-muted-foreground mb-4">
                  <Search size={48} />
                </div>
                <h3 className="font-semibold text-xl">Diagnosis Results</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                  Upload an image and start the diagnosis to see AI-powered health analysis here.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
