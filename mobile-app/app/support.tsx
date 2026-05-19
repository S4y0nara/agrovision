import React, { useState } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView,
    Alert, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CATEGORY_KEYS = ['bug', 'feature', 'diagnosis', 'account', 'general'];

export default function SupportScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const faqs = [0, 1, 2, 3, 4].map(i => ({ q: t(`support.faq.${i}.q`), a: t(`support.faq.${i}.a`) }));
    const categories = CATEGORY_KEYS.map(key => t(`support.categories.${key}`));
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [feedbackName, setFeedbackName] = useState('');
    const [feedbackCategory, setFeedbackCategory] = useState(categories[4]);
    const [feedbackMsg, setFeedbackMsg] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!feedbackMsg.trim()) {
            Alert.alert(t('support.emptyTitle'), t('support.emptyMessage'));
            return;
        }
        setSubmitting(true);
        try {
            const feedback = {
                id: Date.now().toString(),
                name: feedbackName.trim() || t('support.anonymous'),
                category: feedbackCategory,
                message: feedbackMsg.trim(),
                date: new Date().toISOString(),
            };
            const existing = await AsyncStorage.getItem('user_feedbacks');
            const all = existing ? JSON.parse(existing) : [];
            all.unshift(feedback);
            await AsyncStorage.setItem('user_feedbacks', JSON.stringify(all));
            setSubmitted(true);
            setFeedbackMsg('');
            setFeedbackName('');
        } catch (e) {
            Alert.alert(t('common.error'), t('support.saveError'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false}>

                    {/* Hero Header */}
                    <LinearGradient colors={['#FFA000', '#FF6F00']} style={styles.hero}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={22} color="#FFF" />
                        </TouchableOpacity>
                        <View style={styles.heroIcon}>
                            <Ionicons name="help-buoy" size={40} color="#FFA000" />
                        </View>
                        <Text style={styles.heroTitle}>{t('support.title')}</Text>
                        <Text style={styles.heroSub}>{t('support.subtitle')}</Text>
                    </LinearGradient>

                    {/* Quick Contact */}
                    <View style={styles.contactRow}>
                        <TouchableOpacity style={styles.contactCard}>
                            <Ionicons name="chatbubble-ellipses" size={24} color="#4CAF50" />
                            <Text style={styles.contactLabel}>{t('support.liveChat')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contactCard}>
                            <Ionicons name="mail" size={24} color="#2196F3" />
                            <Text style={styles.contactLabel}>{t('support.emailUs')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contactCard}>
                            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                            <Text style={styles.contactLabel}>WhatsApp</Text>
                        </TouchableOpacity>
                    </View>

                    {/* FAQs */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('support.faqTitle')}</Text>
                        {faqs.map((faq, i) => (
                            <TouchableOpacity
                                key={i}
                                style={styles.faqItem}
                                onPress={() => setOpenFaq(openFaq === i ? null : i)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.faqHeader}>
                                    <Text style={styles.faqQ}>{faq.q}</Text>
                                    <Ionicons
                                        name={openFaq === i ? 'chevron-up' : 'chevron-down'}
                                        size={18}
                                        color="#999"
                                    />
                                </View>
                                {openFaq === i && (
                                    <Text style={styles.faqA}>{faq.a}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Feedback Form */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('support.sendFeedback')}</Text>
                        <View style={styles.card}>
                            {submitted ? (
                                <View style={styles.successBox}>
                                    <View style={styles.successIcon}>
                                        <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                                    </View>
                                    <Text style={styles.successTitle}>{t('support.thankYou')}</Text>
                                    <Text style={styles.successSub}>{t('support.successSub')}</Text>
                                    <TouchableOpacity style={styles.newFeedbackBtn} onPress={() => setSubmitted(false)}>
                                        <Text style={styles.newFeedbackBtnText}>{t('support.sendAnother')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <Text style={styles.inputLabel}>{t('support.nameLabel')}</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={t('support.namePlaceholder')}
                                        value={feedbackName}
                                        onChangeText={setFeedbackName}
                                        placeholderTextColor="#BBB"
                                    />

                                    <Text style={styles.inputLabel}>{t('support.category')}</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                                        {categories.map(cat => (
                                            <TouchableOpacity
                                                key={cat}
                                                style={[styles.categoryChip, feedbackCategory === cat && styles.categoryChipActive]}
                                                onPress={() => setFeedbackCategory(cat)}
                                            >
                                                <Text style={[styles.categoryChipText, feedbackCategory === cat && styles.categoryChipTextActive]}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    <Text style={styles.inputLabel}>{t('support.messageLabel')}</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder={t('support.messagePlaceholder')}
                                        value={feedbackMsg}
                                        onChangeText={setFeedbackMsg}
                                        multiline
                                        numberOfLines={5}
                                        placeholderTextColor="#BBB"
                                        textAlignVertical="top"
                                    />

                                    <TouchableOpacity
                                        style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                                        onPress={handleSubmit}
                                        disabled={submitting}
                                    >
                                        <Ionicons name="send" size={18} color="#FFF" />
                                        <Text style={styles.submitBtnText}>{submitting ? t('support.sending') : t('support.submit')}</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Contact Info */}
                    <View style={[styles.section, { marginBottom: 110 }]}>
                        <Text style={styles.sectionTitle}>{t('support.contactInfo')}</Text>
                        <View style={styles.card}>
                            {[
                                { icon: 'mail-outline', label: 'support@agrovision.ai', color: '#2196F3' },
                                { icon: 'globe-outline', label: 'www.agrovision.ai', color: '#4CAF50' },
                                { icon: 'logo-instagram', label: '@agrovision', color: '#E1306C' },
                            ].map((item, i) => (
                                <View key={i} style={[styles.contactInfoRow, i < 2 && styles.contactInfoBorder]}>
                                    <View style={[styles.contactInfoIcon, { backgroundColor: item.color + '15' }]}>
                                        <Ionicons name={item.icon as any} size={20} color={item.color} />
                                    </View>
                                    <Text style={styles.contactInfoText}>{item.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    hero: { paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center' },
    backBtn: { position: 'absolute', top: 54, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 16, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
    heroTitle: { fontSize: 26, fontWeight: 'bold', color: '#FFF', marginBottom: 6 },
    heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },

    contactRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginTop: -20, marginBottom: 10 },
    contactCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 8, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
    contactLabel: { fontSize: 12, fontWeight: '600', color: '#555' },

    section: { paddingHorizontal: 20, marginTop: 24 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 14 },

    faqItem: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
    faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    faqQ: { flex: 1, fontSize: 14, fontWeight: '600', color: '#2E3333', paddingRight: 10 },
    faqA: { marginTop: 10, fontSize: 13, color: '#666', lineHeight: 20 },

    card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 12 },
    input: { backgroundColor: '#F5F7FA', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#E8ECF0' },
    textArea: { height: 120, paddingTop: 12 },
    categoryScroll: { marginBottom: 4 },
    categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0F0', marginRight: 8, marginVertical: 4 },
    categoryChipActive: { backgroundColor: '#4CAF50' },
    categoryChipText: { fontSize: 12, fontWeight: '600', color: '#666' },
    categoryChipTextActive: { color: '#FFF' },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 14, marginTop: 20 },
    submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

    successBox: { alignItems: 'center', paddingVertical: 20, gap: 12 },
    successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
    successTitle: { fontSize: 22, fontWeight: 'bold', color: '#2E3333' },
    successSub: { fontSize: 14, color: '#777', textAlign: 'center', lineHeight: 20 },
    newFeedbackBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#4CAF50' },
    newFeedbackBtnText: { color: '#4CAF50', fontWeight: '600' },

    contactInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    contactInfoBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    contactInfoIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    contactInfoText: { fontSize: 14, color: '#444', fontWeight: '500' },
});
