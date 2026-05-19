import { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './PlantScanner.css';

const PlantScanner = () => {
    const { t, lang } = useLanguage();
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [analysisState, setAnalysisState] = useState('idle'); // idle | analyzing | result
    const [result, setResult] = useState(null);
    const [analysisStep, setAnalysisStep] = useState(0);

    // Protection for logged in only
    useEffect(() => {
        if (!user) {
            navigate('/signin');
        }
    }, [user, navigate]);

    const analysisSteps = [
        { icon: '🔬', label: t('scanner_step_1') },
        { icon: '🧬', label: t('scanner_step_2') },
        { icon: '🌿', label: t('scanner_step_3') },
        { icon: '📊', label: t('scanner_step_4') },
    ];

    const normalizeImageFile = useCallback((file) => new Promise((resolve) => {
        if (!file || !file.type.startsWith('image/')) {
            resolve(file);
            return;
        }

        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            const maxSide = 1600;
            const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
            const width = Math.max(1, Math.round(image.width * scale));
            const height = Math.max(1, Math.round(image.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, width, height);

            canvas.toBlob((blob) => {
                URL.revokeObjectURL(objectUrl);
                if (!blob) {
                    resolve(file);
                    return;
                }

                const baseName = file.name?.replace(/\.[^.]+$/, '') || 'camera-leaf';
                resolve(new File([blob], `${baseName}.jpg`, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                }));
            }, 'image/jpeg', 0.95);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };

        image.src = objectUrl;
    }), []);

    const handleFile = useCallback(async (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const normalizedFile = await normalizeImageFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            setUploadedImage(e.target.result);
            setImageFile(normalizedFile);
            setAnalysisState('idle');
            setResult(null);
        };
        reader.readAsDataURL(normalizedFile);
    }, [normalizeImageFile]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        handleFile(file);
    }, [handleFile]);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(e.type === 'dragenter' || e.type === 'dragover');
    }, []);

    const handleInputChange = (e) => {
        handleFile(e.target.files[0]);
    };

    const startAnalysis = async () => {
        if (!uploadedImage || !imageFile) return;
        setAnalysisState('analyzing');
        setAnalysisStep(0);

        // Animation steps simulation
        let step = 0;
        const animInterval = setInterval(() => {
            step++;
            if (step < analysisSteps.length) {
                setAnalysisStep(step);
            } else {
                clearInterval(animInterval);
            }
        }, 800);

        try {
            const formData = new FormData();
            formData.append('file', imageFile);
            formData.append('language', lang?.toLowerCase() || 'fr');

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/disease';
            console.log('[PlantScanner] Sending to:', apiUrl);
            console.log('[PlantScanner] Language:', lang?.toLowerCase() || 'fr');
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            console.log('[PlantScanner] Response status:', response.status);

            if (!response.ok) {
                const errText = await response.text();
                console.error('[PlantScanner] Server error response:', errText);
                throw new Error(`Server returned ${response.status}: ${errText}`);
            }

            const data = await response.json();
            console.log('[PlantScanner] Response data:', data);
            
            // Map the potato-only model response to UI result structure.
            const isHealthy = data.originalClass === 'Healthy' || (data.class && data.class.toLowerCase().includes('health')) || (data.class && data.class.toLowerCase().includes('sain'));
            const confidencePercent = Math.round(data.confidence * 100);
            let diseaseClass = data.class;
            const original = data.originalClass || '';

            if (isHealthy || original === 'Healthy') {
                diseaseClass = t('Potato_Healthy') || t('Healthy');
            } else if (original === 'Early Blight') {
                diseaseClass = t('Potato_Early_Blight') || t('Early_Blight');
            } else if (original === 'Late Blight') {
                diseaseClass = t('Potato_Late_Blight') || t('Late_Blight');
            } else if (original === 'Diseased' || diseaseClass === 'Diseased') {
                diseaseClass = t('Diseased');
            }
            const plantNameStr = 'Solanum tuberosum';
            const commonNameStr = t('Potato') || 'Potato';

            let dynamicTreatment = data.treatment || '';
            let dynamicRecommend = data.recommendations || [];
            
            // Save to /api/scans
            if (user) {
                try {
                    const saveUrl = import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}/api/scans` : 'http://localhost:5001/api/scans';
                    await fetch(saveUrl, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            userId: user._id || user.id,
                            plantName: plantNameStr,
                            commonName: commonNameStr,
                            disease: diseaseClass,
                            confidence: confidencePercent,
                            imageUrl: uploadedImage,
                            treatment: dynamicTreatment
                        })
                    });
                } catch (e) {
                    console.error('[PlantScanner] Failed to save scan:', e);
                }
            }

            // Compute language-aware fallback recommendations (used if backend returns empty array)
            const currentLang = lang?.toLowerCase() || 'fr';
            const fallbackRecs = {
                ar: {
                    healthy: ['انتظر حتى موعد الحصاد', 'استمر في الري المنتظم'],
                    sick: ['إزالة الأوراق المصابة', 'تطبيق مبيد فطري مناسب', 'ضمان تهوية جيدة للنبات', 'تجنب الري من الأعلى']
                },
                fr: {
                    healthy: ['Attendez la récolte', 'Continuez l\'arrosage régulier'],
                    sick: ['Retirer les feuilles affectées', 'Appliquer un fongicide approprié', 'Assurer une bonne circulation d\'air', 'Éviter l\'arrosage par aspersion']
                },
                en: {
                    healthy: ['Wait for harvest', 'Continue regular watering'],
                    sick: ['Remove affected leaves', 'Apply appropriate fungicide', 'Ensure good air circulation', 'Avoid overhead watering']
                }
            };
            const langRecs = fallbackRecs[currentLang] || fallbackRecs.en;
            const finalRecommendations = dynamicRecommend.length > 0
                ? dynamicRecommend
                : (dynamicTreatment ? [] : (isHealthy ? langRecs.healthy : langRecs.sick));

            // Wait for at least some animation time to finish if needed
            setTimeout(() => {
                clearInterval(animInterval);
                setAnalysisStep(analysisSteps.length);
                
                setResult({
                    plantName: plantNameStr,
                    commonName: commonNameStr,
                    health: isHealthy ? 'healthy' : 'danger',
                    healthScore: isHealthy ? 100 : Math.max(0, 100 - confidencePercent),
                    disease: diseaseClass,
                    confidence: confidencePercent,
                    treatmentString: dynamicTreatment,
                    recommendations: finalRecommendations,
                    urgency: isHealthy ? t('None') : t('High'),
                    urgencyColor: isHealthy ? '#4ade80' : '#ef4444',
                });
                setAnalysisState('result');
            }, Math.max(0, 2500 - (step * 800))); // Dynamic wait
        } catch (error) {
            console.error('[PlantScanner] Analysis error:', error);
            clearInterval(animInterval);
            alert(`Error analyzing image:\n${error.message}`);
            setAnalysisState('idle');
        }
    };

    const resetScanner = () => {
        setUploadedImage(null);
        setImageFile(null);
        setAnalysisState('idle');
        setResult(null);
        setAnalysisStep(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const healthColor = result
        ? result.health === 'healthy' ? '#4ade80'
        : result.health === 'warning' ? '#f59e0b' : '#ef4444'
        : '#4ade80';

    return (
        <div className="scanner-page">
            {/* Ambient background blobs */}
            <div className="scanner-blob scanner-blob-1" />
            <div className="scanner-blob scanner-blob-2" />
            <div className="scanner-blob scanner-blob-3" />

            <div className="scanner-container">
                {/* Header */}
                <div className="scanner-header">
                    <div className="scanner-badge">
                        <span className="scanner-badge-dot" />
                        {t('scanner_badge')}
                    </div>
                    <h1 className="scanner-title">{t('scanner_title')}</h1>
                    <p className="scanner-subtitle">{t('scanner_subtitle')}</p>
                </div>

                {/* Stats Row */}
                <div className="scanner-stats">
                    {[
                        { icon: '🌱', value: '98%', label: t('scanner_stat_1') },
                        { icon: '⚡', value: '<3s', label: t('scanner_stat_2') },
                        { icon: '🔬', value: '500+', label: t('scanner_stat_3') },
                        { icon: '🌍', value: '24/7', label: t('scanner_stat_4') },
                    ].map((stat, i) => (
                        <div className="scanner-stat-card" key={i}>
                            <span className="scanner-stat-icon">{stat.icon}</span>
                            <span className="scanner-stat-value">{stat.value}</span>
                            <span className="scanner-stat-label">{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Main Content */}
                <div className="scanner-main">
                    {/* Upload / Preview Panel */}
                    <div className="scanner-upload-panel">
                        <div className="scanner-panel-title">
                            <span>📷</span> {t('scanner_upload_title')}
                        </div>

                        {!uploadedImage ? (
                            <div
                                className={`scanner-dropzone ${dragActive ? 'drag-active' : ''}`}
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleInputChange}
                                    id="plant-file-input"
                                />
                                <input
                                    ref={cameraInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    style={{ display: 'none' }}
                                    onChange={handleInputChange}
                                    id="plant-camera-input"
                                />
                                <div className="dropzone-content">
                                    <div className="dropzone-icon-ring">
                                        <div className="dropzone-icon-inner">🌿</div>
                                    </div>
                                    <p className="dropzone-title">{t('scanner_drop_title')}</p>
                                    <p className="dropzone-desc">{t('scanner_drop_desc')}</p>
                                    <div className="dropzone-formats">
                                        <span>JPG</span><span>PNG</span><span>WEBP</span><span>HEIC</span>
                                    </div>
                                    <div className="dropzone-actions">
                                        <button
                                            type="button"
                                            className="dropzone-btn"
                                            id="scanner-upload-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                fileInputRef.current?.click();
                                            }}
                                        >
                                            {t('scanner_browse')}
                                        </button>
                                        <button
                                            type="button"
                                            className="dropzone-btn camera-btn"
                                            id="scanner-camera-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                cameraInputRef.current?.click();
                                            }}
                                        >
                                            <i className="bx bx-camera"></i> Camera
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="scanner-preview">
                                <img src={uploadedImage} alt="Plant" className="scanner-preview-img" />
                                {analysisState === 'analyzing' && (
                                    <div className="scanner-overlay">
                                        <div className="scanner-scan-line" />
                                        <div className="scanner-scan-corners">
                                            <span /><span /><span /><span />
                                        </div>
                                    </div>
                                )}
                                <div className="scanner-preview-actions">
                                    <button className="preview-action-btn remove-btn" onClick={resetScanner} id="scanner-remove-btn">
                                        🗑️ {t('scanner_remove')}
                                    </button>
                                    {analysisState !== 'result' && (
                                        <button
                                            className="preview-action-btn analyze-btn"
                                            onClick={startAnalysis}
                                            disabled={analysisState === 'analyzing'}
                                            id="scanner-analyze-btn"
                                        >
                                            {analysisState === 'analyzing' ? (
                                                <><span className="btn-spinner" /> {t('scanner_analyzing')}</>
                                            ) : (
                                                <> 🔬 {t('scanner_analyze')}</>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Analysis Steps */}
                        {analysisState === 'analyzing' && (
                            <div className="scanner-steps">
                                {analysisSteps.map((step, i) => (
                                    <div
                                        key={i}
                                        className={`scanner-step ${i < analysisStep ? 'step-done' : i === analysisStep ? 'step-active' : 'step-pending'}`}
                                    >
                                        <div className="step-icon">{i < analysisStep ? '✅' : step.icon}</div>
                                        <span>{step.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Result Panel */}
                    <div className="scanner-result-panel">
                        {analysisState === 'idle' && !result && (
                            <div className="scanner-idle-panel">
                                <div className="idle-icon">🌱</div>
                                <h3>{t('scanner_idle_title')}</h3>
                                <p>{t('scanner_idle_desc')}</p>

                                <div className="scanner-features">
                                    {[
                                        { icon: '🦠', title: t('scanner_feat_1_title'), desc: t('scanner_feat_1_desc') },
                                        { icon: '💊', title: t('scanner_feat_2_title'), desc: t('scanner_feat_2_desc') },
                                        { icon: '🧪', title: t('scanner_feat_3_title'), desc: t('scanner_feat_3_desc') },
                                        { icon: '📈', title: t('scanner_feat_4_title'), desc: t('scanner_feat_4_desc') },
                                    ].map((f, i) => (
                                        <div className="scanner-feature-card" key={i}>
                                            <span className="feature-icon">{f.icon}</span>
                                            <div>
                                                <div className="feature-title">{f.title}</div>
                                                <div className="feature-desc">{f.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {analysisState === 'analyzing' && (
                            <div className="scanner-analyzing-panel">
                                <div className="analyzing-pulse">
                                    <div className="pulse-ring" />
                                    <div className="pulse-ring pulse-ring-2" />
                                    <div className="pulse-core">🤖</div>
                                </div>
                                <h3>{t('scanner_ai_working')}</h3>
                                <p>{t('scanner_ai_desc')}</p>
                            </div>
                        )}

                        {analysisState === 'result' && result && (
                            <div className="scanner-results" id="scanner-results">
                                {/* Plant Identity */}
                                <div className="result-identity">
                                    <div className="result-plant-info">
                                        <div className="result-plant-icon">🍅</div>
                                        <div>
                                            <div className="result-common-name">{result.commonName}</div>
                                            <div className="result-scientific-name">{result.plantName}</div>
                                        </div>
                                    </div>
                                    <div className="result-confidence">
                                        <div className="confidence-value">{result.confidence}%</div>
                                        <div className="confidence-label">{t('scanner_confidence')}</div>
                                    </div>
                                </div>

                                {/* Health Score */}
                                <div className="result-health">
                                    <div className="health-header">
                                        <span>{t('scanner_health_score')}</span>
                                        <span className="health-value" style={{ color: healthColor }}>{result.healthScore}/100</span>
                                    </div>
                                    <div className="health-bar-bg">
                                        <div
                                            className="health-bar-fill"
                                            style={{ width: `${result.healthScore}%`, background: healthColor }}
                                        />
                                    </div>
                                    <div className="health-disease">
                                        <span className="disease-badge" style={{ borderColor: result.urgencyColor, color: result.urgencyColor }}>
                                            ⚠️ {result.disease}
                                        </span>
                                        <span className="urgency-tag" style={{ background: result.urgencyColor + '22', color: result.urgencyColor }}>
                                            {result.urgency}
                                        </span>
                                    </div>
                                </div>

                                {/* Recommendations */}
                                <div className="result-recommendations">
                                    <div className="result-section-title">💡 {t('scanner_recommendations')}</div>
                                    {result.treatmentString ? (
                                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#ccc', backgroundColor: '#0f172a', padding: '16px', borderRadius: '12px' }}>
                                            {result.treatmentString}
                                        </div>
                                    ) : (
                                        <ul className="recommendations-list">
                                            {result.recommendations.map((rec, i) => (
                                                <li key={i} className="recommendation-item">
                                                    <span className="rec-icon">→</span>
                                                    {rec}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="result-actions">
                                    <button className="action-btn primary-action" onClick={resetScanner} id="scanner-scan-again">
                                        🔄 {t('scanner_scan_again')}
                                    </button>
                                    <button className="action-btn secondary-action" id="scanner-save-report">
                                        📥 {t('scanner_save_report')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlantScanner;
