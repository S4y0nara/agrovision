import React, { useState, useRef } from 'react';
import {
  Alert, StyleSheet, View, Text, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';

import { API_URL } from '@/constants/api';

WebBrowser.maybeCompleteAuthSession();

interface SignUpScreenProps {
    onNext: () => void;
    onBack: () => void;
}

export default function SignUpScreen({ onNext, onBack }: SignUpScreenProps) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // OTP state
    const [showOTP, setShowOTP] = useState(false);
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const otpRefs = useRef<(TextInput | null)[]>([]);

    const getPasswordStrength = () => {
        if (password.length === 0) return { label: '', color: 'transparent', score: 0 };
        if (password.length < 6) return { label: t('signup.weak'), color: '#F44336', score: 1 };

        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score < 2) return { label: t('signup.fair'), color: '#FF9800', score: 2 };
        return { label: t('signup.strong'), color: '#4CAF50', score: 3 };
    };

    const strength = getPasswordStrength();
    const isPasswordMatch = password === confirmPassword && password.length > 0;
    const canRegister = name && email && strength.score >= 2 && isPasswordMatch;

    const storeSession = async (data: any) => {
        await AsyncStorage.setItem('user_id', data.user.id);
        await AsyncStorage.setItem('user_token', data.token);
        await AsyncStorage.setItem('user_name', data.user.fullName || name);
        await AsyncStorage.setItem('user_email', data.user.email || email);
        await AsyncStorage.setItem('user_role', data.user.role || 'user');
    };

    // Step 1: Register and get 6-digit code sent
    const handleRegister = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: name, email, password }),
            });
            const data = await response.json();

            if (response.ok || response.status === 202) {
                if (data.requiresVerification) {
                    setShowOTP(true);
                    Alert.alert('Check your email', `We sent a 6-digit code to ${email}`);
                    return;
                }
                if (data.token && data.user) {
                    await storeSession(data);
                    onNext();
                }
            } else {
                Alert.alert('Registration failed', data.message || 'Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            Alert.alert('Connection Error', 'Could not connect to the server.');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verify the 6-digit code
    const handleVerifyCode = async () => {
        const code = otpDigits.join('');
        if (code.length !== 6) {
            Alert.alert('Invalid Code', 'Please enter all 6 digits.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/auth/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = await response.json();

            if (response.ok) {
                if (data.token && data.user) {
                    await storeSession(data);
                }
                onNext();
            } else {
                Alert.alert('Verification Failed', data.message || 'Invalid or expired code.');
            }
        } catch (error) {
            Alert.alert('Connection Error', 'Could not connect to the server.');
        } finally {
            setIsLoading(false);
        }
    };

    // Resend code
    const handleResendCode = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            Alert.alert('Code Sent', data.message || 'A new code has been sent to your email.');
        } catch (error) {
            Alert.alert('Error', 'Could not resend code.');
        } finally {
            setIsLoading(false);
        }
    };

    // OTP input handler
    const handleOtpChange = (text: string, index: number) => {
        const newDigits = [...otpDigits];
        // Handle paste of full code
        if (text.length > 1) {
            const digits = text.replace(/[^0-9]/g, '').split('').slice(0, 6);
            digits.forEach((d, i) => { if (i < 6) newDigits[i] = d; });
            setOtpDigits(newDigits);
            otpRefs.current[Math.min(digits.length, 5)]?.focus();
            return;
        }
        newDigits[index] = text.replace(/[^0-9]/g, '');
        setOtpDigits(newDigits);
        if (text && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    // Google Auth
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        androidClientId: '28957856923-h9h0332kb7b8sjpnb33sm46m89tuqdal.apps.googleusercontent.com',
        iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
        clientId: '240557675177-65nl33f8qnrrhk1aahnp47r4eha6immt.apps.googleusercontent.com',
    });

    React.useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            if (id_token) handleGoogleLoginBackend(id_token);
        }
    }, [response]);

    const handleGoogleLoginBackend = async (idToken: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/google/mobile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });
            const data = await res.json();
            if (res.ok) {
                await storeSession(data);
                onNext();
            } else {
                Alert.alert('Google Auth Failed', data.message || 'Login failed');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not verify Google login.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFacebookLogin = async () => {
        const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
        if (!facebookAppId) {
            Alert.alert('Facebook Auth', 'Add EXPO_PUBLIC_FACEBOOK_APP_ID to enable Facebook login on mobile.');
            return;
        }

        setIsLoading(true);
        try {
            const redirectUri = AuthSession.makeRedirectUri({ scheme: 'mobileapp' });
            const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${facebookAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=email,public_profile`;
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
            if (result.type !== 'success') return;

            const accessToken = new URL(result.url.replace('#', '?')).searchParams.get('access_token');
            if (!accessToken) throw new Error('Missing Facebook access token');

            const res = await fetch(`${API_URL}/api/auth/facebook/mobile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Login failed');

            await storeSession(data);
            onNext();
        } catch (error: any) {
            Alert.alert('Facebook Auth Failed', error.message || 'Could not verify Facebook login.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── OTP Verification Screen ───────────────────────────────────────────────
    if (showOTP) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setShowOTP(false)}>
                            <Ionicons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.otpScrollContent}>
                        <View style={styles.otpIconCircle}>
                            <Ionicons name="mail-open-outline" size={48} color="#4CAF50" />
                        </View>

                        <Text style={styles.otpTitle}>Verify your email</Text>
                        <Text style={styles.otpSubtitle}>
                            Enter the 6-digit code we sent to{'\n'}
                            <Text style={styles.otpEmail}>{email}</Text>
                        </Text>

                        {/* OTP Input Boxes */}
                        <View style={styles.otpRow}>
                            {otpDigits.map((digit, i) => (
                                <TextInput
                                    key={i}
                                    ref={(ref) => { otpRefs.current[i] = ref; }}
                                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                                    value={digit}
                                    onChangeText={(text) => handleOtpChange(text, i)}
                                    onKeyPress={(e) => handleOtpKeyPress(e, i)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    selectTextOnFocus
                                    autoFocus={i === 0}
                                />
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.verifyButton, isLoading && styles.buttonDisabled]}
                            onPress={handleVerifyCode}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.verifyButtonText}>VERIFY & CONTINUE</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.resendRow}>
                            <Text style={styles.resendText}>Didn&apos;t receive the code? </Text>
                            <TouchableOpacity onPress={handleResendCode} disabled={isLoading}>
                                <Text style={styles.resendLink}>Resend</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.otpHint}>
                            <Ionicons name="information-circle-outline" size={16} color="#666" />
                            <Text style={styles.otpHintText}>
                                The code expires in 10 minutes. Check your spam folder if you don&apos;t see it.
                            </Text>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // ── Registration Form ─────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack}>
                        <Image
                            source={require('../assets/images/agrovision logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onBack}>
                        <Text style={styles.signInLink}>{t('onboarding.signIn')}</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.content}>
                        <Text style={styles.stepIndicator}>{t('signup.stepIndicator')}</Text>
                        <Text style={styles.title}>{t('signup.title')}</Text>
                        <Text style={styles.subtitle}>{t('signup.subtitle')}</Text>

                        <View style={styles.form}>
                            <View style={styles.inputContainer}>
                                <TextInput style={styles.input} placeholder={t('signup.fullName')} placeholderTextColor="#999" value={name} onChangeText={setName} />
                            </View>

                            <View style={styles.inputContainer}>
                                <TextInput style={styles.input} placeholder={t('signup.email')} placeholderTextColor="#999" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                            </View>

                            <View style={styles.inputContainer}>
                                <TextInput style={styles.input} placeholder={t('signup.password')} placeholderTextColor="#999" secureTextEntry value={password} onChangeText={setPassword} />
                            </View>

                            {password.length > 0 && (
                                <View style={styles.strengthContainer}>
                                    <View style={styles.strengthBarContainer}>
                                        <View style={[styles.strengthBar, { width: `${(strength.score / 3) * 100}%`, backgroundColor: strength.color }]} />
                                    </View>
                                    <Text style={[styles.strengthText, { color: strength.color }]}>
                                        {t('signup.passwordStrength')}: {strength.label}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.inputContainer}>
                                <TextInput style={styles.input} placeholder={t('signup.confirmPassword')} placeholderTextColor="#999" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
                            </View>

                            {confirmPassword.length > 0 && !isPasswordMatch && (
                                <Text style={styles.errorText}>{t('signup.passwordsDoNotMatch')}</Text>
                            )}

                            <TouchableOpacity
                                style={[styles.nextButton, (!canRegister || isLoading) && styles.nextButtonDisabled]}
                                onPress={handleRegister}
                                disabled={!canRegister || isLoading}
                            >
                                {isLoading ? <ActivityIndicator color="#FFF" /> : (
                                    <Text style={styles.nextButtonText}>{t('signup.next')}</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.dividerContainer}>
                                <View style={styles.divider} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.divider} />
                            </View>

                            <TouchableOpacity style={styles.googleButton} onPress={() => promptAsync()} disabled={!request || isLoading}>
                                <Text style={styles.googleButtonText}>Continue with Google</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.facebookButton} onPress={handleFacebookLogin} disabled={isLoading}>
                                <Text style={styles.facebookButtonText}>Continue with Facebook</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 80 },
    logo: { marginLeft: -40, width: 120, height: 60 },
    signInLink: { fontSize: 16, fontWeight: 'bold', color: '#2E3333' },
    scrollContent: { flexGrow: 1, paddingHorizontal: 25, paddingBottom: 40 },
    content: { paddingTop: 20 },
    stepIndicator: { fontSize: 13, fontWeight: '600', color: '#777', letterSpacing: 1, marginBottom: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#2E3333', lineHeight: 34, marginBottom: 15 },
    subtitle: { fontSize: 18, color: '#555', lineHeight: 24, marginBottom: 30 },
    form: { gap: 15 },
    inputContainer: { borderWidth: 1, borderColor: '#CCC', borderRadius: 4, backgroundColor: '#F9F9F9' },
    input: { paddingVertical: 15, paddingHorizontal: 15, fontSize: 16, color: '#333' },
    strengthContainer: { marginTop: -5, marginBottom: 5 },
    strengthBarContainer: { height: 4, backgroundColor: '#EEE', borderRadius: 2, overflow: 'hidden', marginBottom: 5 },
    strengthBar: { height: '100%' },
    strengthText: { fontSize: 12, fontWeight: '600' },
    errorText: { color: '#F44336', fontSize: 12, marginTop: -10, marginBottom: 5 },
    nextButton: { backgroundColor: '#4CAF50', paddingVertical: 18, borderRadius: 4, alignItems: 'center', marginTop: 10, elevation: 2 },
    nextButtonDisabled: { backgroundColor: '#A5D6A7' },
    nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1.2 },
    buttonDisabled: { backgroundColor: '#A5D6A7' },
    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
    divider: { flex: 1, height: 1, backgroundColor: '#DDD' },
    dividerText: { marginHorizontal: 10, color: '#888', fontWeight: 'bold' },
    googleButton: { backgroundColor: '#FFF', borderColor: '#DDD', borderWidth: 1, paddingVertical: 16, borderRadius: 4, alignItems: 'center', elevation: 1 },
    googleButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
    facebookButton: { backgroundColor: '#1877F2', paddingVertical: 16, borderRadius: 4, alignItems: 'center', elevation: 1 },
    facebookButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    // ── OTP Screen ──
    otpScrollContent: { flexGrow: 1, paddingHorizontal: 30, alignItems: 'center', paddingTop: 40 },
    otpIconCircle: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center',
        marginBottom: 28,
    },
    otpTitle: { fontSize: 26, fontWeight: '800', color: '#1B2E1B', marginBottom: 10, textAlign: 'center' },
    otpSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    otpEmail: { fontWeight: '700', color: '#4CAF50' },
    otpRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
    otpBox: {
        width: 48, height: 56, borderRadius: 12,
        borderWidth: 2, borderColor: '#DDD', backgroundColor: '#FAFAFA',
        textAlign: 'center', fontSize: 22, fontWeight: '800', color: '#1B2E1B',
    },
    otpBoxFilled: { borderColor: '#4CAF50', backgroundColor: '#F0FDF4' },
    verifyButton: {
        backgroundColor: '#4CAF50', paddingVertical: 18, borderRadius: 12,
        alignItems: 'center', width: '100%', elevation: 3,
    },
    verifyButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
    resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
    resendText: { color: '#888', fontSize: 14 },
    resendLink: { color: '#4CAF50', fontSize: 14, fontWeight: '800' },
    otpHint: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        marginTop: 28, backgroundColor: '#F9F9F9', borderRadius: 12,
        padding: 14, width: '100%',
    },
    otpHintText: { flex: 1, fontSize: 12, color: '#666', lineHeight: 18 },
});
