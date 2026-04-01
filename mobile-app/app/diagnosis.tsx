import React, { useEffect, useRef, useState } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, SafeAreaView,
    ActivityIndicator, Image, Dimensions, Platform, Modal, ScrollView, Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildPlantLabel, DiagnosedPlant, parseStoredPlants, STORAGE_KEYS } from '@/utils/appStorage';

const { width, height } = Dimensions.get('window');
const API_URL = 'http://192.168.1.15:5001';

export default function DiagnosisScreen() {
    const router = useRouter();
    const cameraRef = useRef<CameraView | null>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [flash, setFlash] = useState<FlashMode>('off');
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (!permission?.granted) requestPermission();
    }, [permission, requestPermission]);

    const saveDiagnosis = async (uri: string, result: string) => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEYS.diagnosedPlants);
            const existingPlants = parseStoredPlants(stored);

            const newPlant: DiagnosedPlant = {
                id: Date.now().toString(),
                uri,
                label: buildPlantLabel(result),
                result,
                date: new Date().toISOString(),
            };

            const nextPlants = [newPlant, ...existingPlants].slice(0, 25);
            await AsyncStorage.setItem(STORAGE_KEYS.diagnosedPlants, JSON.stringify(nextPlants));
        } catch (error) {
            console.error('Error saving diagnosis:', error);
        }
    };

    const takePicture = async () => {
        if (!cameraRef.current || isCapturing) return;
        setIsCapturing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.85,
                base64: false,
                skipProcessing: false,
            });
            if (photo?.uri) setCapturedPhoto(photo.uri);
        } catch (e) {
            console.error('Camera error:', e);
        } finally {
            setIsCapturing(false);
        }
    };

    const pickFromGallery = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
            setCapturedPhoto(result.assets[0].uri);
        }
    };

    const handleTapFocus = (e: any) => {
        const { locationX, locationY } = e.nativeEvent;
        setFocusPoint({ x: locationX, y: locationY });
        setTimeout(() => setFocusPoint(null), 1500);
    };

    const toggleFlash = () => {
        setFlash((prev) => prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off');
    };

    const analyzePhoto = async () => {
        if (!capturedPhoto) return;
        setIsAnalyzing(true);
        try {
            const formData = new FormData();
            formData.append('image', {
                uri: capturedPhoto,
                type: 'image/jpeg',
                name: 'plant_diagnosis.jpg',
            } as any);

            const response = await fetch(`${API_URL}/api/chat/diagnose`, {
                method: 'POST',
                headers: { 'Content-Type': 'multipart/form-data' },
                body: formData,
            });

            let resultText = 'No diagnosis available.';

            if (response.ok) {
                const data = await response.json();
                resultText = data.reply || data.result || resultText;
            } else {
                const chatResponse = await fetch(`${API_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: 'I am uploading a plant photo for diagnosis. Please explain likely plant diseases, symptoms to look for, and treatment options.'
                    }),
                });
                const chatData = await chatResponse.json();
                resultText = chatData.reply || 'Could not analyze the image. Please describe your plant symptoms in the chat.';
            }

            setAnalysisResult(resultText);
            await saveDiagnosis(capturedPhoto, resultText);
        } catch (error) {
            const fallback = 'Unable to connect to the server. Please check your connection and ensure the backend is running.\n\nYou can also describe your plant symptoms directly in the AI chat for advice.';
            setAnalysisResult(fallback);
            await saveDiagnosis(capturedPhoto, fallback);
        } finally {
            setIsAnalyzing(false);
            setShowResult(true);
        }
    };

    const flashIcon = flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-auto';

    if (!permission) {
        return (
            <SafeAreaView style={styles.dark}>
                <ActivityIndicator size="large" color="#4CAF50" />
            </SafeAreaView>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.dark}>
                <StatusBar style="light" />
                <View style={styles.permissionBox}>
                    <View style={styles.permIconCircle}>
                        <MaterialCommunityIcons name="camera-off" size={44} color="#F44336" />
                    </View>
                    <Text style={styles.permTitle}>Camera Access Required</Text>
                    <Text style={styles.permSub}>AgroVision needs camera access to diagnose plant diseases in real time.</Text>
                    <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                        <Ionicons name="camera" size={18} color="#FFF" />
                        <Text style={styles.permBtnText}>Grant Camera Access</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Text style={styles.backBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (capturedPhoto) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" />
                <Image source={{ uri: capturedPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={styles.topGrad} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.bottomGrad} />

                <SafeAreaView style={styles.topBar}>
                    <TouchableOpacity style={styles.topBtn} onPress={() => { setCapturedPhoto(null); setAnalysisResult(null); setShowResult(false); }}>
                        <Ionicons name="arrow-back" size={22} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.previewTitle}>Review Photo</Text>
                    <View style={{ width: 44 }} />
                </SafeAreaView>

                <View style={styles.previewActions}>
                    <TouchableOpacity style={styles.retakeBtn} onPress={() => { setCapturedPhoto(null); setAnalysisResult(null); setShowResult(false); }}>
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

                <Modal visible={showResult} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.resultCard}>
                            <View style={styles.resultHandle} />
                            <View style={styles.resultHeader}>
                                <View style={styles.resultIconCircle}>
                                    <MaterialCommunityIcons name="leaf-circle" size={28} color="#4CAF50" />
                                </View>
                                <Text style={styles.resultTitle}>Plant Diagnosis</Text>
                                <TouchableOpacity onPress={() => setShowResult(false)}>
                                    <Ionicons name="close-circle" size={28} color="#CCC" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
                                <Text style={styles.resultText}>{analysisResult}</Text>
                            </ScrollView>
                            <TouchableOpacity
                                style={styles.chatBtn}
                                onPress={() => {
                                    setShowResult(false);
                                    router.push({
                                        pathname: '/(tabs)/chat',
                                        params: { prompt: `Here is my latest plant diagnosis: ${analysisResult ?? ''}. Give me clear treatment steps and irrigation advice.` }
                                    });
                                }}
                            >
                                <Ionicons name="chatbubble-ellipses" size={18} color="#FFF" />
                                <Text style={styles.chatBtnText}>Continue in Chat</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                flash={flash}
            />

            <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={handleTapFocus}>
                {focusPoint && (
                    <View style={[styles.focusRing, { top: focusPoint.y - 35, left: focusPoint.x - 35 }]}>
                        <View style={styles.focusInner} />
                    </View>
                )}
            </TouchableOpacity>

            <LinearGradient colors={['rgba(0,0,0,0.65)', 'transparent']} style={styles.topGrad} />

            <SafeAreaView style={styles.topBar}>
                <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>

                <View style={styles.topCenterLabel}>
                    <MaterialCommunityIcons name="leaf-circle-outline" size={18} color="#4CAF50" />
                    <Text style={styles.screenTitle}>Plant Diagnosis</Text>
                </View>

                <TouchableOpacity style={styles.topBtn} onPress={toggleFlash}>
                    <Ionicons name={flashIcon as any} size={22} color={flash === 'off' ? '#FFF' : '#FFD600'} />
                </TouchableOpacity>
            </SafeAreaView>

            <View style={styles.scanArea}>
                <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanHint}>Point at the affected leaf or plant</Text>
            </View>

            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.bottomGrad} />

            <View style={styles.controls}>
                <TouchableOpacity style={styles.sideBtn} onPress={pickFromGallery}>
                    <Ionicons name="images-outline" size={26} color="#FFF" />
                    <Text style={styles.sideBtnLabel}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shutterOuter} onPress={takePicture} disabled={isCapturing} activeOpacity={0.8}>
                    <View style={styles.shutterInner}>
                        {isCapturing ? <ActivityIndicator size="small" color="#4CAF50" /> : <View style={styles.shutterDot} />}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.sideBtn} onPress={() => Alert.alert('Tips', '• Ensure good lighting\n• Fill the frame with the leaf\n• Keep steady for sharp photos\n• Focus on the affected area')}>
                    <Ionicons name="information-circle-outline" size={26} color="#FFF" />
                    <Text style={styles.sideBtnLabel}>Tips</Text>
                </TouchableOpacity>
            </View>

            <View style={{ height: Platform.OS === 'ios' ? 30 : 20 }} />
        </View>
    );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    dark: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    permissionBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
    permIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    permTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF', textAlign: 'center' },
    permSub: { fontSize: 14, color: '#AAA', textAlign: 'center', lineHeight: 20 },
    permBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4CAF50', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, marginTop: 8 },
    permBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    backBtn: { paddingVertical: 10 },
    backBtnText: { color: '#888', fontSize: 14 },
    topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 160, zIndex: 5 },
    bottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, zIndex: 5 },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 44 },
    topBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    topCenterLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
    screenTitle: { color: '#FFF', fontWeight: '600', fontSize: 14 },
    scanArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 6, justifyContent: 'center', alignItems: 'center' },
    scanFrame: { width: width * 0.72, height: width * 0.72, position: 'relative' },
    corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: '#4CAF50' },
    cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 4 },
    cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 4 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 4 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 4 },
    scanHint: { marginTop: 20, color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    focusRing: { position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 1.5, borderColor: '#FFD600', justifyContent: 'center', alignItems: 'center', zIndex: 8 },
    focusInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD600' },
    controls: { position: 'absolute', bottom: 50, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 30 },
    shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
    shutterInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    shutterDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#E0E0E0' },
    sideBtn: { alignItems: 'center', gap: 6 },
    sideBtnLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
    previewTitle: { color: '#FFF', fontWeight: '600', fontSize: 16 },
    previewActions: { position: 'absolute', bottom: 50, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 30 },
    retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    retakeBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
    analyzeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4CAF50', paddingHorizontal: 26, paddingVertical: 14, borderRadius: 30, elevation: 6, shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 8 },
    analyzeBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    resultCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: height * 0.75 },
    resultHandle: { width: 40, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    resultIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
    resultTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#1B5E20' },
    resultScroll: { maxHeight: height * 0.45, marginBottom: 16 },
    resultText: { fontSize: 14, lineHeight: 22, color: '#333' },
    chatBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4CAF50', borderRadius: 16, paddingVertical: 14 },
    chatBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});
