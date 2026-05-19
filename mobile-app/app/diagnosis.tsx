import React, { useState } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, SafeAreaView,
    ActivityIndicator, Image, Dimensions, Platform, Modal, ScrollView, Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { DiagnosedPlant, parseStoredPlants, STORAGE_KEYS } from '@/utils/appStorage';
import { API_URL } from '@/constants/api';

const { width, height } = Dimensions.get('window');

interface AnalysisResult {
    plantName: string;
    scientificName: string;
    disease: string;
    confidence: number;
    healthScore: number;
    healthStatus: 'healthy' | 'warning' | 'danger';
    recommendations: string[];
    urgency: string;
    urgencyColor: string;
}

export default function DiagnosisScreen() {
    const router = useRouter();
    const { i18n } = useTranslation();
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [showResult, setShowResult] = useState(false);

    const saveDiagnosis = async (uri: string, resultLabel: string) => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEYS.diagnosedPlants);
            const existingPlants = parseStoredPlants(stored);

            const newPlant: DiagnosedPlant = {
                id: Date.now().toString(),
                uri,
                label: resultLabel,
                result: resultLabel,
                date: new Date().toISOString(),
            };

            const nextPlants = [newPlant, ...existingPlants].slice(0, 25);
            await AsyncStorage.setItem(STORAGE_KEYS.diagnosedPlants, JSON.stringify(nextPlants));
        } catch (error) {
            console.error('Error saving diagnosis:', error);
        }
    };

    // Opens the native camera via ImagePicker — works reliably in Expo Go
    const launchCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Camera Permission Required',
                'Please allow camera access in your device settings to take photos.',
                [{ text: 'OK' }]
            );
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
            exif: false,
        });

        if (!result.canceled && result.assets[0]) {
            setSelectedAsset(result.assets[0]);
            setCapturedPhoto(result.assets[0].uri);
            setResult(null);
            setShowResult(false);
        }
    };

    const pickFromGallery = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
            setSelectedAsset(result.assets[0]);
            setCapturedPhoto(result.assets[0].uri);
            setResult(null);
            setShowResult(false);
        }
    };

    const reset = () => {
        setCapturedPhoto(null);
        setSelectedAsset(null);
        setResult(null);
        setShowResult(false);
    };

    const analyzePhoto = async () => {
        if (!capturedPhoto) return;
        setIsAnalyzing(true);
        try {
            const fileName = selectedAsset?.fileName || capturedPhoto.split('/').pop() || 'plant_diagnosis.jpg';
            const lowerName = fileName.toLowerCase();
            const mimeType = selectedAsset?.mimeType
                || (lowerName.endsWith('.png') ? 'image/png' : lowerName.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

            const formData = new FormData();
            formData.append('file', {
                uri: capturedPhoto,
                type: mimeType,
                name: fileName.includes('.') ? fileName : `${fileName}.jpg`,
            } as any);
            formData.append('language', i18n.language ? i18n.language.toLowerCase() : 'fr');

            const token = await AsyncStorage.getItem('user_token');
            const response = await fetch(`${API_URL}/api/disease`, {
                method: 'POST',
                headers: {
                    'ngrok-skip-browser-warning': 'true',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);

            const data = await response.json();

            const isHealthy = data.originalClass === 'Healthy' || (data.class && data.class.toLowerCase().includes('health')) || (data.class && data.class.toLowerCase().includes('sain'));
            const confidencePercent = Math.round(data.confidence * 100);
            const originalClass = data.originalClass || '';
            const language = i18n.language ? i18n.language.toLowerCase() : 'fr';
            const potatoLabels: Record<string, Record<string, string>> = {
                fr: {
                    Healthy: 'Pomme de terre saine',
                    'Early Blight': 'Alternariose de la pomme de terre',
                    'Late Blight': 'Mildiou de la pomme de terre',
                },
                en: {
                    Healthy: 'Healthy Potato',
                    'Early Blight': 'Potato Early Blight',
                    'Late Blight': 'Potato Late Blight',
                },
                ar: {
                    Healthy: 'بطاطس سليمة',
                    'Early Blight': 'اللفحة المبكرة في البطاطس',
                    'Late Blight': 'اللفحة المتأخرة في البطاطس',
                },
            };
            const diseaseLabel = potatoLabels[language]?.[originalClass]
                || potatoLabels.en[originalClass]
                || data.class;

            let dynamicRecommend = data.recommendations || [];

            const analysisResult: AnalysisResult = {
                plantName: 'Potato',
                scientificName: 'Solanum tuberosum',
                disease: diseaseLabel,
                confidence: confidencePercent,
                healthStatus: isHealthy ? 'healthy' : 'danger',
                healthScore: isHealthy ? 100 : Math.max(0, 100 - confidencePercent),
                recommendations: dynamicRecommend.length > 0 ? dynamicRecommend : (isHealthy
                    ? ['Wait for harvest', 'Continue regular watering']
                    : ['Remove affected leaves', 'Apply appropriate fungicide', 'Ensure good air circulation', 'Avoid overhead watering']),
                urgency: isHealthy ? 'None' : 'High',
                urgencyColor: isHealthy ? '#4CAF50' : '#F44336',
            };

            setResult(analysisResult);
            setShowResult(true);
            await saveDiagnosis(capturedPhoto, `${analysisResult.plantName}: ${analysisResult.disease}`);
        } catch (error) {
            console.error('Analysis error:', error);
            Alert.alert('Analysis Failed', 'Unable to connect to the server. Please check your connection and ensure the backend is running.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ── Photo Preview Screen ──────────────────────────────────────────────────
    if (capturedPhoto) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                <Image source={{ uri: capturedPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={styles.topGrad} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.bottomGrad} />

                <SafeAreaView style={styles.topBar}>
                    <TouchableOpacity style={styles.topBtn} onPress={reset}>
                        <Ionicons name="arrow-back" size={22} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.previewTitle}>Review Photo</Text>
                    <View style={{ width: 44 }} />
                </SafeAreaView>

                <View style={styles.previewActions}>
                    <TouchableOpacity style={styles.retakeBtn} onPress={reset}>
                        <Ionicons name="refresh" size={20} color="#FFF" />
                        <Text style={styles.retakeBtnText}>Retake</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.analyzeBtn} onPress={analyzePhoto} disabled={isAnalyzing}>
                        {isAnalyzing ? (
                            <>
                                <ActivityIndicator size="small" color="#FFF" />
                                <Text style={styles.analyzeBtnText}>Analyzing...</Text>
                            </>
                        ) : (
                            <>
                                <MaterialCommunityIcons name="leaf-circle" size={22} color="#FFF" />
                                <Text style={styles.analyzeBtnText}>Analyze Plant</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Result Modal */}
                <Modal visible={showResult} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.resultCard}>
                            <View style={styles.resultHandle} />

                            {result && (
                                <>
                                    <View style={styles.resultHeader}>
                                        <View style={[styles.resultIconCircle, { backgroundColor: result.urgencyColor + '22' }]}>
                                            <MaterialCommunityIcons name="leaf" size={28} color={result.urgencyColor} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.resultTitle}>{result.plantName}</Text>
                                            <Text style={styles.scientificName}>{result.scientificName}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setShowResult(false)}>
                                            <Ionicons name="close-circle" size={28} color="#CCC" />
                                        </TouchableOpacity>
                                    </View>

                                    <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
                                        <View style={styles.statsRow}>
                                            <View style={styles.statCard}>
                                                <Text style={styles.statLabel}>Confidence</Text>
                                                <Text style={styles.statValue}>{result.confidence}%</Text>
                                                <View style={styles.statBarBg}>
                                                    <View style={[styles.statBarFill, { width: `${result.confidence}%`, backgroundColor: '#4CAF50' }]} />
                                                </View>
                                            </View>
                                            <View style={styles.statCard}>
                                                <Text style={styles.statLabel}>Health Score</Text>
                                                <Text style={[styles.statValue, { color: result.urgencyColor }]}>{result.healthScore}/100</Text>
                                                <View style={styles.statBarBg}>
                                                    <View style={[styles.statBarFill, { width: `${result.healthScore}%`, backgroundColor: result.urgencyColor }]} />
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.diagnosisBox}>
                                            <Text style={styles.sectionTitle}>Diagnosis</Text>
                                            <View style={[styles.diseaseBadge, { borderColor: result.urgencyColor, backgroundColor: result.urgencyColor + '15' }]}>
                                                <Text style={[styles.diseaseText, { color: result.urgencyColor }]}>⚠️ {result.disease}</Text>
                                            </View>
                                            <View style={[styles.urgencyTag, { backgroundColor: result.urgencyColor }]}>
                                                <Text style={styles.urgencyText}>{result.urgency} Urgency</Text>
                                            </View>
                                        </View>

                                        <View style={styles.detailsBox}>
                                            <Text style={styles.sectionTitle}>Recommendations</Text>
                                            {result.recommendations.map((rec, i) => (
                                                <View key={i} style={styles.recommendationItem}>
                                                    <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                                                    <Text style={styles.recommendationText}>{rec}</Text>
                                                </View>
                                            ))}
                                        </View>

                                        <View style={styles.detailsBox}>
                                            <Text style={styles.sectionTitle}>Nutrient Analysis (EST.)</Text>
                                            {[
                                                { k: 'N', v: 75, c: '#4CAF50' },
                                                { k: 'P', v: 60, c: '#2196F3' },
                                                { k: 'K', v: 85, c: '#FF9800' }
                                            ].map((n, i) => (
                                                <View key={i} style={styles.nutrientRow}>
                                                    <Text style={styles.nutrientLabel}>{n.k}</Text>
                                                    <View style={styles.nutrientBarWrapper}>
                                                        <View style={styles.statBarBg}>
                                                            <View style={[styles.statBarFill, { width: `${n.v}%`, backgroundColor: n.c }]} />
                                                        </View>
                                                    </View>
                                                    <Text style={styles.nutrientValue}>{n.v}%</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </ScrollView>

                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            style={styles.chatBtn}
                                            onPress={() => {
                                                setShowResult(false);
                                                router.push({
                                                    pathname: '/(tabs)/chat',
                                                    params: { prompt: `My plant has been diagnosed with ${result.disease}. It's a ${result.plantName}. Can you give me more details on how to treat it?` }
                                                });
                                            }}
                                        >
                                            <Ionicons name="chatbubble-ellipses" size={18} color="#FFF" />
                                            <Text style={styles.chatBtnText}>Consult AgroBot</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowResult(false)}>
                                            <Text style={styles.secondaryBtnText}>Done</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    // ── Landing Screen ────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.landingContainer}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.landingHeader}>
                <TouchableOpacity style={styles.landingBack} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.landingTitle}>Plant Diagnosis</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Hero Illustration */}
            <View style={styles.heroSection}>
                <LinearGradient
                    colors={['#E8F5E9', '#C8E6C9']}
                    style={styles.heroCircle}
                >
                    <MaterialCommunityIcons name="leaf-circle-outline" size={90} color="#2E7D32" />
                </LinearGradient>
                <Text style={styles.heroTitle}>Diagnose Your Plant</Text>
                <Text style={styles.heroSubtitle}>
                    Take a photo or upload an image of your plant&apos;s leaf to instantly detect diseases with AI.
                </Text>
            </View>

            {/* Feature Pills */}
            <View style={styles.featurePills}>
                {[
                    { icon: 'brain', label: 'AI Detection' },
                    { icon: 'flash', label: 'Instant Results' },
                    { icon: 'shield-check', label: '500+ Diseases' },
                ].map((f, i) => (
                    <View key={i} style={styles.pill}>
                        <MaterialCommunityIcons name={f.icon as any} size={14} color="#2E7D32" />
                        <Text style={styles.pillText}>{f.label}</Text>
                    </View>
                ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionSection}>
                <TouchableOpacity style={styles.primaryBtn} onPress={launchCamera} activeOpacity={0.85}>
                    <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.primaryBtnGrad}>
                        <Ionicons name="camera" size={26} color="#FFF" />
                        <View style={styles.btnTextGroup}>
                            <Text style={styles.primaryBtnLabel}>Take a Photo</Text>
                            <Text style={styles.primaryBtnSub}>Opens your camera app</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryActionBtn} onPress={pickFromGallery} activeOpacity={0.85}>
                    <View style={styles.secondaryActionInner}>
                        <MaterialCommunityIcons name="image-multiple-outline" size={26} color="#4CAF50" />
                        <View style={styles.btnTextGroup}>
                            <Text style={styles.secondaryActionLabel}>Upload from Gallery</Text>
                            <Text style={styles.secondaryActionSub}>Choose an existing photo</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#CCC" />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Tip Banner */}
            <View style={styles.tipBanner}>
                <Ionicons name="bulb-outline" size={18} color="#F59E0B" />
                <Text style={styles.tipText}>
                    <Text style={{ fontWeight: '700' }}>Tip: </Text>
                    Focus on the affected leaf and ensure good lighting for accurate results.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // ── Shared ────────────────────────────────────────────────────────────────
    container: { flex: 1, backgroundColor: '#000' },
    topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 160, zIndex: 5 },
    bottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, zIndex: 5 },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 44 },
    topBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    previewTitle: { color: '#FFF', fontWeight: '600', fontSize: 16 },
    previewActions: { position: 'absolute', bottom: 50, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 30 },
    retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    retakeBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
    analyzeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4CAF50', paddingHorizontal: 26, paddingVertical: 14, borderRadius: 30, elevation: 6, shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 8 },
    analyzeBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

    // ── Landing Screen ────────────────────────────────────────────────────────
    landingContainer: { flex: 1, backgroundColor: '#FAFAFA' },
    landingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 8 : 16, paddingBottom: 12, backgroundColor: '#FAFAFA' },
    landingBack: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
    landingTitle: { fontSize: 18, fontWeight: '700', color: '#1B1B1B' },

    heroSection: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 24, paddingBottom: 28 },
    heroCircle: { width: 160, height: 160, borderRadius: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 24, elevation: 4, shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16 },
    heroTitle: { fontSize: 26, fontWeight: '800', color: '#1B2E1B', marginBottom: 10, textAlign: 'center' },
    heroSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },

    featurePills: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 32 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    pillText: { fontSize: 12, fontWeight: '600', color: '#2E7D32' },

    actionSection: { paddingHorizontal: 20, gap: 14, marginBottom: 24 },
    primaryBtn: { borderRadius: 20, overflow: 'hidden', elevation: 6, shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
    primaryBtnGrad: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
    btnTextGroup: { flex: 1 },
    primaryBtnLabel: { color: '#FFF', fontSize: 17, fontWeight: '700' },
    primaryBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

    secondaryActionBtn: { borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
    secondaryActionInner: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
    secondaryActionLabel: { color: '#1B2E1B', fontSize: 17, fontWeight: '700' },
    secondaryActionSub: { color: '#999', fontSize: 12, marginTop: 2 },

    tipBanner: { marginHorizontal: 20, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#FDE68A' },
    tipText: { flex: 1, fontSize: 13, color: '#78350F', lineHeight: 18 },

    // ── Result Modal ──────────────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    resultCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: height * 0.85 },
    resultHandle: { width: 40, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    resultIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    resultTitle: { fontSize: 22, fontWeight: 'bold', color: '#1B5E20' },
    scientificName: { color: '#666', fontSize: 12, fontStyle: 'italic' },
    resultScroll: { marginBottom: 16 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    statCard: { flex: 1, backgroundColor: '#F5F7F5', padding: 12, borderRadius: 16 },
    statLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
    statBarBg: { height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, overflow: 'hidden' },
    statBarFill: { height: '100%', borderRadius: 3 },
    diagnosisBox: { marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1B5E20', marginBottom: 10 },
    diseaseBadge: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
    diseaseText: { fontSize: 16, fontWeight: 'bold' },
    urgencyTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    urgencyText: { color: '#FFF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    detailsBox: { marginBottom: 20, backgroundColor: '#F9F9F9', padding: 16, borderRadius: 16 },
    recommendationItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    recommendationText: { flex: 1, fontSize: 14, color: '#444', lineHeight: 20 },
    nutrientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    nutrientLabel: { width: 20, fontWeight: 'bold', color: '#666' },
    nutrientBarWrapper: { flex: 1, marginHorizontal: 12 },
    nutrientValue: { width: 35, fontSize: 12, textAlign: 'right', color: '#666' },
    actionButtons: { gap: 12 },
    chatBtn: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4CAF50', borderRadius: 16, paddingVertical: 16 },
    chatBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    secondaryBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    secondaryBtnText: { color: '#666', fontWeight: 'bold' },
});
