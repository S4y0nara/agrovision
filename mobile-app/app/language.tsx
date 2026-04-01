import React, { useMemo, useState } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    SafeAreaView, Alert, I18nManager
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English', region: 'Global', icon: 'language-outline' },
    { code: 'fr', name: 'French', native: 'Français', region: 'Afrique du Nord', icon: 'chatbox-ellipses-outline' },
    { code: 'ar', name: 'Arabic', native: '???????', region: 'Tunisia', icon: 'globe-outline', rtl: true },
] as const;

export default function LanguageScreen() {
    const { i18n } = useTranslation();
    const router = useRouter();
    const [selected, setSelected] = useState(i18n.language || 'en');

    const currentLanguage = useMemo(
        () => LANGUAGES.find((item) => item.code === selected) ?? LANGUAGES[0],
        [selected]
    );

    const handleApply = async () => {
        try {
            await i18n.changeLanguage(selected);
            await AsyncStorage.setItem('user-language', selected);

            const shouldUseRTL = selected === 'ar';
            if (I18nManager.isRTL !== shouldUseRTL) {
                I18nManager.allowRTL(shouldUseRTL);
                I18nManager.forceRTL(shouldUseRTL);
                Alert.alert('Language updated', 'Restart the app to fully apply the new layout direction.', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
                return;
            }

            router.back();
        } catch (e) {
            console.error('Language change error:', e);
            Alert.alert('Language update failed', 'Please try again.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <LinearGradient colors={['#1E3A8A', '#2563EB']} style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={22} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.headerTopRow}>
                    <View>
                        <Text style={styles.headerEyebrow}>PREFERENCES</Text>
                        <Text style={styles.headerTitle}>Choose your language</Text>
                        <Text style={styles.headerSub}>Select the language you want AgroVision to use across the app.</Text>
                    </View>
                    <View style={styles.headerBadge}>
                        <Ionicons name="globe-outline" size={28} color="#1E3A8A" />
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>CURRENT SELECTION</Text>
                    <View style={styles.summaryRow}>
                        <View>
                            <Text style={styles.summaryTitle}>{currentLanguage.native}</Text>
                            <Text style={styles.summarySub}>{currentLanguage.name} · {currentLanguage.region}</Text>
                        </View>
                        <View style={styles.summaryPill}>
                            <Text style={styles.summaryPillText}>{currentLanguage.code.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.listLabel}>AVAILABLE LANGUAGES</Text>
                {LANGUAGES.map((lang) => {
                    const isSelected = selected === lang.code;
                    return (
                        <TouchableOpacity
                            key={lang.code}
                            style={[styles.langRow, isSelected && styles.langRowActive]}
                            onPress={() => setSelected(lang.code)}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.langIconWrap, isSelected && styles.langIconWrapActive]}>
                                <Ionicons name={lang.icon as any} size={22} color={isSelected ? '#2563EB' : '#5B6472'} />
                            </View>
                            <View style={styles.langInfo}>
                                <Text style={[styles.langNative, isSelected && styles.langNativeActive]}>{lang.native}</Text>
                                <Text style={styles.langRegion}>{lang.name} · {lang.region}</Text>
                            </View>
                            <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                                {isSelected && <View style={styles.radioInner} />}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={[styles.applyBtn, selected === i18n.language && styles.applyBtnDisabled]} onPress={handleApply}>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.applyBtnText}>Apply language</Text>
                </TouchableOpacity>
                <Text style={styles.footerNote}>Arabic may require an app restart to fully switch layout direction.</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F6FB' },
    header: { paddingTop: 52, paddingBottom: 30, paddingHorizontal: 20 },
    backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
    headerEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
    headerTitle: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom: 8, maxWidth: '85%' },
    headerSub: { color: 'rgba(255,255,255,0.86)', fontSize: 14, lineHeight: 21, maxWidth: 250 },
    headerBadge: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, paddingHorizontal: 20 },
    summaryCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginTop: -8, marginBottom: 24, borderWidth: 1, borderColor: '#E6ECF5' },
    summaryLabel: { color: '#7B8794', fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 14 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
    summaryTitle: { fontSize: 22, fontWeight: '800', color: '#122033' },
    summarySub: { fontSize: 13, color: '#6A7482', marginTop: 4 },
    summaryPill: { backgroundColor: '#E8F0FF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    summaryPillText: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
    listLabel: { fontSize: 11, fontWeight: '700', color: '#7B8794', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
    langRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 18, marginBottom: 12, gap: 14, borderWidth: 1.5, borderColor: '#E6ECF5' },
    langRowActive: { borderColor: '#2563EB', backgroundColor: '#F8FBFF' },
    langIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F3F6FB', justifyContent: 'center', alignItems: 'center' },
    langIconWrapActive: { backgroundColor: '#E8F0FF' },
    langInfo: { flex: 1 },
    langNative: { fontSize: 17, fontWeight: '700', color: '#182232' },
    langNativeActive: { color: '#2563EB' },
    langRegion: { fontSize: 12, color: '#788394', marginTop: 3 },
    radioOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#C5D0DE', justifyContent: 'center', alignItems: 'center' },
    radioOuterActive: { borderColor: '#2563EB' },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2563EB' },
    footer: { padding: 20, paddingBottom: 30, borderTopWidth: 1, borderTopColor: '#E8EDF4', backgroundColor: '#FFF', gap: 10 },
    applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563EB', borderRadius: 18, paddingVertical: 16 },
    applyBtnDisabled: { backgroundColor: '#9DB7F4' },
    applyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
    footerNote: { textAlign: 'center', fontSize: 12, color: '#8A94A3', lineHeight: 18 },
});
