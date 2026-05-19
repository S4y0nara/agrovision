import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { API_URL } from '@/constants/api';

WebBrowser.maybeCompleteAuthSession();

interface LoginScreenProps {
    onLoginSuccess: () => void;
    onBack: () => void;
    onGoToSignUp: () => void;
}

export default function LoginScreen({ onLoginSuccess, onBack, onGoToSignUp }: LoginScreenProps) {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [isResetLoading, setIsResetLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Save to storage
                await AsyncStorage.setItem('user_id', data.user.id);
                await AsyncStorage.setItem('user_token', data.token);
                await AsyncStorage.setItem('user_name', data.user.fullName || 'User');
                await AsyncStorage.setItem('user_email', data.user.email);
                await AsyncStorage.setItem('user_role', data.user.role || 'user');
                onLoginSuccess();
            } else {
                Alert.alert('Login Failed', data.message || 'Invalid email or password.');
            }
        } catch (error) {
            console.error('Login Error:', error);
            Alert.alert('Connection Error', 'Could not connect to the server. Please check your internet and ensure the backend is running.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        const targetEmail = resetEmail || email;
        if (!targetEmail) {
            Alert.alert('Email Required', 'Please enter your email address.');
            return;
        }

        setIsResetLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetEmail }),
            });
            const data = await response.json();
            Alert.alert(response.ok ? 'Check your email' : 'Reset failed', data.message || 'If this account exists, a reset email has been sent.');
            if (response.ok) setShowForgotModal(false);
        } catch (error) {
            console.error('Forgot password error:', error);
            Alert.alert('Connection Error', 'Could not connect to the server.');
        } finally {
            setIsResetLoading(false);
        }
    };

    // Google Auth Logic
    // IMPORTANT: For real devices, you MUST use platform-specific IDs from Google Cloud Console
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        androidClientId: '28957856923-h9h0332kb7b8sjpnb33sm46m89tuqdal.apps.googleusercontent.com',
        iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
        clientId: '240557675177-65nl33f8qnrrhk1aahnp47r4eha6immt.apps.googleusercontent.com',
    });

    React.useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            if (id_token) {
                handleGoogleLoginBackend(id_token);
            }
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
                await AsyncStorage.setItem('user_id', data.user.id);
                await AsyncStorage.setItem('user_token', data.token);
                await AsyncStorage.setItem('user_name', data.user.fullName);
                await AsyncStorage.setItem('user_email', data.user.email);
                await AsyncStorage.setItem('user_role', data.user.role || 'user');
                onLoginSuccess();
            } else {
                Alert.alert('Google Auth Failed', data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Error connecting to backend for Google Auth:', error);
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

            await AsyncStorage.setItem('user_id', data.user.id);
            await AsyncStorage.setItem('user_token', data.token);
            await AsyncStorage.setItem('user_name', data.user.fullName);
            await AsyncStorage.setItem('user_email', data.user.email);
            await AsyncStorage.setItem('user_role', data.user.role || 'user');
            onLoginSuccess();
        } catch (error: any) {
            Alert.alert('Facebook Auth Failed', error.message || 'Could not verify Facebook login.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack}>
                        <Image
                            source={require('../assets/images/agrovision logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.content}>
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>
                            Sign in to continue your agricultural journey with AgroVision.
                        </Text>

                        <View style={styles.form}>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email Address"
                                    placeholderTextColor="#999"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    placeholderTextColor="#999"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.forgotButton}
                                onPress={() => {
                                    setResetEmail(email);
                                    setShowForgotModal(true);
                                }}
                            >
                                <Text style={styles.forgotText}>Forgot password?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                                onPress={handleLogin}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.loginButtonText}>SIGN IN</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.dividerContainer}>
                                <View style={styles.divider} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.divider} />
                            </View>

                            <TouchableOpacity
                                style={styles.googleButton}
                                onPress={() => promptAsync()}
                                disabled={!request || isLoading}
                            >
                                <Text style={styles.googleButtonText}>Continue with Google</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.facebookButton}
                                onPress={handleFacebookLogin}
                                disabled={isLoading}
                            >
                                <Text style={styles.facebookButtonText}>Continue with Facebook</Text>
                            </TouchableOpacity>

                            <View style={styles.footer}>
                                <Text style={styles.footerText}>Don&apos;t have an account? </Text>
                                <TouchableOpacity onPress={onGoToSignUp}>
                                    <Text style={styles.signUpLink}>Sign Up</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={showForgotModal} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.resetCard}>
                        <Text style={styles.resetTitle}>Reset password</Text>
                        <Text style={styles.resetSubtitle}>We will send a secure reset link to your email.</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor="#999"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={resetEmail}
                                onChangeText={setResetEmail}
                            />
                        </View>
                        <TouchableOpacity style={[styles.loginButton, isResetLoading && styles.buttonDisabled]} onPress={handleForgotPassword} disabled={isResetLoading}>
                            {isResetLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>SEND RESET LINK</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelReset} onPress={() => setShowForgotModal(false)}>
                            <Text style={styles.cancelResetText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { paddingHorizontal: 20, height: 80, justifyContent: 'center' },
    logo: { width: 120, height: 60, marginLeft: -40 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 25, paddingBottom: 40 },
    content: { paddingTop: 20 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#2E3333', marginBottom: 10 },
    subtitle: { fontSize: 16, color: '#555', lineHeight: 22, marginBottom: 30 },
    form: { gap: 15 },
    inputContainer: { borderWidth: 1, borderColor: '#CCC', borderRadius: 4, backgroundColor: '#F9F9F9' },
    input: { paddingVertical: 15, paddingHorizontal: 15, fontSize: 16, color: '#333' },
    forgotButton: { alignSelf: 'flex-end', marginTop: -6 },
    forgotText: { color: '#4CAF50', fontSize: 13, fontWeight: '700' },
    loginButton: { backgroundColor: '#4CAF50', paddingVertical: 18, borderRadius: 4, alignItems: 'center', marginTop: 10, elevation: 2 },
    buttonDisabled: { backgroundColor: '#A5D6A7' },
    loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1.2 },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#DDD',
    },
    dividerText: {
        marginHorizontal: 10,
        color: '#888',
        fontWeight: 'bold',
    },
    googleButton: {
        backgroundColor: '#FFF',
        borderColor: '#DDD',
        borderWidth: 1,
        paddingVertical: 16,
        borderRadius: 4,
        alignItems: 'center',
        elevation: 1,
    },
    googleButtonText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '600',
    },
    facebookButton: {
        backgroundColor: '#1877F2',
        paddingVertical: 16,
        borderRadius: 4,
        alignItems: 'center',
        elevation: 1,
    },
    facebookButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    footerText: { color: '#777', fontSize: 14 },
    signUpLink: { color: '#4CAF50', fontSize: 14, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
    resetCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 22, gap: 14 },
    resetTitle: { fontSize: 22, fontWeight: '800', color: '#1B2E1B' },
    resetSubtitle: { fontSize: 14, color: '#666', lineHeight: 20 },
    cancelReset: { alignItems: 'center', paddingVertical: 8 },
    cancelResetText: { color: '#666', fontWeight: '700' },
});
