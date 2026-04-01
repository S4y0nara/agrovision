import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    StyleSheet, View, Text, ScrollView, TouchableOpacity,
    SafeAreaView, Image, Dimensions
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { DiagnosedPlant, getSeverityLabel, parseStoredPlants, STORAGE_KEYS } from '@/utils/appStorage';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
    const router = useRouter();
    const [plants, setPlants] = useState<DiagnosedPlant[]>([]);
    const [selected, setSelected] = useState<DiagnosedPlant | null>(null);

    useEffect(() => {
        loadPlants();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadPlants();
        }, [])
    );

    const loadPlants = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEYS.diagnosedPlants);
            setPlants(parseStoredPlants(stored));
        } catch (e) {
            console.error(e);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const stats = useMemo(() => ({
        total: plants.length,
        healthy: plants.filter((p) => p.label.toLowerCase().includes('healthy')).length,
        issues: plants.filter((p) => !p.label.toLowerCase().includes('healthy')).length,
    }), [plants]);

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <LinearGradient colors={['#2196F3', '#1565C0']} style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <View style={styles.headerIcon}>
                        <MaterialCommunityIcons name="chart-timeline-variant" size={32} color="#2196F3" />
                    </View>
                    <Text style={styles.headerTitle}>Plant Analytics</Text>
                    <Text style={styles.headerSub}>{plants.length} diagnosis{plants.length !== 1 ? 'es' : ''} recorded</Text>
                </View>
            </LinearGradient>

            {plants.length === 0 ? (
                <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="leaf-off" size={80} color="#C8E6C9" />
                    <Text style={styles.emptyTitle}>No Diagnoses Yet</Text>
                    <Text style={styles.emptySub}>Use the Diagnose Now feature on the home screen to analyze your plants.</Text>
                    <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/diagnosis' as any)}>
                        <Ionicons name="camera" size={18} color="#FFF" />
                        <Text style={styles.emptyBtnText}>Start Diagnosing</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Text style={styles.statNum}>{stats.total}</Text>
                            <Text style={styles.statLbl}>Total Scans</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statNum}>{stats.healthy}</Text>
                            <Text style={styles.statLbl}>Healthy</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={[styles.statNum, { color: '#F44336' }]}>{stats.issues}</Text>
                            <Text style={styles.statLbl}>Issues Found</Text>
                        </View>
                    </View>

                    <Text style={styles.listLabel}>PREVIOUS DIAGNOSES</Text>

                    {plants.map((plant) => (
                        <TouchableOpacity
                            key={plant.id}
                            style={styles.plantCard}
                            onPress={() => setSelected(plant)}
                            activeOpacity={0.85}
                        >
                            <Image source={{ uri: plant.uri }} style={styles.plantThumb} resizeMode="cover" />
                            <View style={styles.plantInfo}>
                                <View style={styles.plantHeaderRow}>
                                    <Text style={styles.plantLabel} numberOfLines={1}>{plant.label}</Text>
                                    <View style={styles.statusPill}>
                                        <Text style={styles.statusPillText}>{getSeverityLabel(plant.label)}</Text>
                                    </View>
                                </View>
                                <Text style={styles.plantDate}>{formatDate(plant.date)}</Text>
                                <Text style={styles.plantExcerpt} numberOfLines={2}>{plant.result}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#CCC" />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {selected && (
                <View style={styles.detailOverlay}>
                    <TouchableOpacity style={styles.detailBackdrop} onPress={() => setSelected(null)} />
                    <View style={styles.detailPanel}>
                        <View style={styles.detailHandle} />
                        <Image source={{ uri: selected.uri }} style={styles.detailImage} resizeMode="cover" />
                        <View style={styles.detailContent}>
                            <View style={styles.detailHeaderRow}>
                                <View>
                                    <Text style={styles.detailLabel}>{selected.label}</Text>
                                    <Text style={styles.detailDate}>{formatDate(selected.date)}</Text>
                                </View>
                                <View style={styles.detailBadge}>
                                    <Text style={styles.detailBadgeText}>{getSeverityLabel(selected.label)}</Text>
                                </View>
                            </View>
                            <ScrollView style={styles.detailScroll}>
                                <Text style={styles.detailResult}>{selected.result}</Text>
                            </ScrollView>
                            <TouchableOpacity
                                style={styles.chatFollowUp}
                                onPress={() => {
                                    setSelected(null);
                                    router.push({
                                        pathname: '/(tabs)/chat' as any,
                                        params: { prompt: `Here is a previous diagnosis: ${selected.result}. Give me follow-up treatment and irrigation guidance.` }
                                    });
                                }}
                            >
                                <Ionicons name="chatbubble-ellipses" size={18} color="#FFF" />
                                <Text style={styles.chatFollowUpText}>Ask AgroBot for More Advice</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    header: { paddingTop: 50, paddingBottom: 32, paddingHorizontal: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    headerContent: { alignItems: 'center', gap: 6 },
    headerIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 8, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
    headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 14 },
    emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
    emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4CAF50', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
    emptyBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    listContent: { padding: 20, paddingBottom: 100 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center', gap: 4, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
    statNum: { fontSize: 26, fontWeight: 'bold', color: '#2196F3' },
    statLbl: { fontSize: 11, color: '#888', fontWeight: '600' },
    listLabel: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1.2, marginBottom: 12 },
    plantCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
    plantThumb: { width: 80, height: 80 },
    plantInfo: { flex: 1, padding: 12 },
    plantHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    plantLabel: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#1A1A1A' },
    plantDate: { fontSize: 11, color: '#999', marginTop: 2, marginBottom: 4 },
    plantExcerpt: { fontSize: 12, color: '#666', lineHeight: 17 },
    statusPill: { backgroundColor: '#EEF6FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    statusPillText: { color: '#1565C0', fontSize: 10, fontWeight: '700' },
    detailOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
    detailBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    detailPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' },
    detailHandle: { width: 40, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
    detailImage: { width: '100%', height: 200 },
    detailContent: { padding: 20, flex: 1 },
    detailHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
    detailLabel: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
    detailDate: { fontSize: 12, color: '#999' },
    detailBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
    detailBadgeText: { color: '#2E7D32', fontSize: 11, fontWeight: '700' },
    detailScroll: { maxHeight: width * 0.55, marginBottom: 16 },
    detailResult: { fontSize: 14, color: '#444', lineHeight: 22 },
    chatFollowUp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 14, marginBottom: 20 },
    chatFollowUpText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
});
