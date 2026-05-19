import React from 'react';
import {
  StyleSheet, View, Text, SafeAreaView, ScrollView, TouchableOpacity,
  Image, Alert, Dimensions, Platform, Modal, TextInput
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCart } from '@/hooks/CartContext';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';

const { width } = Dimensions.get('window');

export default function CartScreen() {
  const { cart, removeFromCart, updateQuantity, clearCart, cartTotal } = useCart();
  const { t } = useTranslation();
  const router = useRouter();

  const deliveryFee = cart.length > 0 ? 7.0 : 0;
  const grandTotal = cartTotal + deliveryFee;
  const [showPayment, setShowPayment] = React.useState(false);
  const [payment, setPayment] = React.useState({ name: '', card: '', expiry: '', cvc: '', address: '' });
  const [paying, setPaying] = React.useState(false);

  const handleCheckout = () => {
    Alert.alert(
      '✅ Order Confirmed',
      `Your order of ${grandTotal.toFixed(2)} DT has been placed successfully!\n\nYou will receive a confirmation shortly.`,
      [
        {
          text: 'Done',
          onPress: () => {
            clearCart();
            router.back();
          },
        },
      ]
    );
  };

  const processCardPayment = async () => {
    const cardDigits = payment.card.replace(/\D/g, '');
    if (!payment.name.trim() || cardDigits.length < 12 || !payment.expiry.trim() || payment.cvc.replace(/\D/g, '').length < 3) {
      Alert.alert('Payment required', 'Please enter valid card details before placing the order.');
      return;
    }

    setPaying(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      const response = await fetch(`${API_URL}/api/user/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.map(item => ({ product: item.id, quantity: item.quantity, price: item.price })),
          totalAmount: grandTotal,
          cardLast4: cardDigits.slice(-4),
          paymentMethod: `Card ending ${cardDigits.slice(-4)}`,
          shippingAddress: payment.address,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Payment failed');
      Alert.alert('Payment accepted', `Your order of ${grandTotal.toFixed(2)} DT has been confirmed.`, [
        { text: 'Done', onPress: () => { clearCart(); setShowPayment(false); router.back(); } },
      ]);
    } catch (error: any) {
      Alert.alert('Payment failed', error.message || 'Could not complete payment.');
    } finally {
      setPaying(false);
    }
  };

  const handleRemoveItem = (id: string, name: string) => {
    Alert.alert(
      'Remove Item',
      `Remove "${name}" from your cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        {cart.length > 0 ? (
          <TouchableOpacity onPress={() =>
            Alert.alert('Clear Cart', 'Remove all items?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear All', style: 'destructive', onPress: clearCart },
            ])
          }>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {cart.length === 0 ? (
        /* ── Empty State ── */
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="cart-off" size={56} color="#C8E6C9" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse the marketplace and add some products to get started.
          </Text>
          <TouchableOpacity style={styles.shopNowBtn} onPress={() => router.back()}>
            <Ionicons name="storefront-outline" size={18} color="#FFF" />
            <Text style={styles.shopNowText}>Browse Marketplace</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Items Count */}
            <Text style={styles.itemsCount}>
              {cart.length} item{cart.length !== 1 ? 's' : ''} in your cart
            </Text>

            {/* Cart Items */}
            {cart.map((item) => {
              const numericPrice = parseFloat(item.price.replace(/[^\d.]/g, '')) || 0;
              const itemTotal = numericPrice * item.quantity;

              return (
                <View key={item.id} style={styles.cartCard}>
                  <Image source={{ uri: item.image }} style={styles.cardImage} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleRemoveItem(item.id, item.name)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.cardUnitPrice}>{item.price} / unit</Text>

                    <View style={styles.cardBottomRow}>
                      {/* Quantity Controls */}
                      <View style={styles.qtyContainer}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Ionicons name="remove" size={16} color="#4CAF50" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Ionicons name="add" size={16} color="#4CAF50" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.cardTotal}>{itemTotal.toFixed(2)} DT</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Order Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Order Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{cartTotal.toFixed(2)} DT</Text>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.deliveryRow}>
                  <Text style={styles.summaryLabel}>Delivery</Text>
                  <Ionicons name="bicycle-outline" size={14} color="#999" style={{ marginLeft: 4 }} />
                </View>
                <Text style={styles.summaryValue}>{deliveryFee.toFixed(2)} DT</Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{grandTotal.toFixed(2)} DT</Text>
              </View>
            </View>

            {/* Promo hint */}
            <View style={styles.promoHint}>
              <Ionicons name="pricetag-outline" size={16} color="#F59E0B" />
              <Text style={styles.promoText}>Free delivery on orders over 200 DT!</Text>
            </View>
          </ScrollView>

          {/* Checkout Footer */}
          <View style={styles.footer}>
            <View style={styles.footerTotal}>
              <Text style={styles.footerTotalLabel}>Total</Text>
              <Text style={styles.footerTotalValue}>{grandTotal.toFixed(2)} DT</Text>
            </View>
            <TouchableOpacity style={styles.checkoutBtn} onPress={() => setShowPayment(true)} activeOpacity={0.85}>
              <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.checkoutGrad}>
                <Ionicons name="lock-closed" size={18} color="#FFF" />
                <Text style={styles.checkoutText}>Place Order</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}
      <Modal visible={showPayment} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Card Payment</Text>
            <Text style={styles.paymentTotal}>{grandTotal.toFixed(2)} DT</Text>
            <TextInput style={styles.paymentInput} placeholder="Name on card" value={payment.name} onChangeText={v => setPayment(p => ({ ...p, name: v }))} />
            <TextInput style={styles.paymentInput} placeholder="4242 4242 4242 4242" keyboardType="number-pad" value={payment.card} onChangeText={v => setPayment(p => ({ ...p, card: v.replace(/[^\d ]/g, '').slice(0, 19) }))} />
            <View style={styles.paymentRow}>
              <TextInput style={[styles.paymentInput, { flex: 1 }]} placeholder="MM/YY" value={payment.expiry} onChangeText={v => setPayment(p => ({ ...p, expiry: v.slice(0, 5) }))} />
              <TextInput style={[styles.paymentInput, { flex: 1 }]} placeholder="CVC" keyboardType="number-pad" value={payment.cvc} onChangeText={v => setPayment(p => ({ ...p, cvc: v.replace(/\D/g, '').slice(0, 4) }))} />
            </View>
            <TextInput style={styles.paymentInput} placeholder="Delivery address" value={payment.address} onChangeText={v => setPayment(p => ({ ...p, address: v }))} />
            <TouchableOpacity style={styles.payButton} onPress={processCardPayment} disabled={paying}>
              <Text style={styles.payButtonText}>{paying ? 'Processing...' : 'Pay and Confirm'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelPayment} onPress={() => setShowPayment(false)}>
              <Text style={styles.cancelPaymentText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 12,
    backgroundColor: '#F8F9FA',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1B1B1B' },
  clearAllText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },

  /* ── Empty ── */
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingBottom: 60,
  },
  emptyIconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#F0FAF0', justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1B2E1B', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  shopNowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#4CAF50', paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 14, elevation: 3,
  },
  shopNowText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  /* ── List ── */
  scrollContent: { paddingHorizontal: 16, paddingBottom: 180 },
  itemsCount: { fontSize: 13, color: '#999', fontWeight: '600', marginBottom: 12, marginTop: 4 },

  cartCard: {
    flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16,
    marginBottom: 12, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  cardImage: { width: 100, height: 110, backgroundColor: '#F5F5F5' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1B1B1B', flex: 1, marginRight: 8 },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center',
  },
  cardUnitPrice: { fontSize: 12, color: '#999', marginTop: 2 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },

  qtyContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0FAF0', borderRadius: 10, overflow: 'hidden',
  },
  qtyBtn: {
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
  },
  qtyText: {
    fontSize: 14, fontWeight: '800', color: '#1B2E1B',
    minWidth: 24, textAlign: 'center',
  },
  cardTotal: { fontSize: 16, fontWeight: '800', color: '#4CAF50' },

  /* ── Summary ── */
  summaryCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 18,
    marginTop: 8, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: '#1B1B1B', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#777' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  summaryDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 8 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#1B1B1B' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#4CAF50' },

  promoHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  promoText: { fontSize: 12, color: '#78350F', flex: 1 },

  /* ── Footer ── */
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', paddingHorizontal: 16,
    paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12,
  },
  footerTotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  footerTotalLabel: { fontSize: 14, fontWeight: '600', color: '#777' },
  footerTotalValue: { fontSize: 20, fontWeight: '800', color: '#1B1B1B' },
  checkoutBtn: { borderRadius: 16, overflow: 'hidden', elevation: 4 },
  checkoutGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  checkoutText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  paymentCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, gap: 12 },
  paymentTitle: { fontSize: 22, fontWeight: '800', color: '#1B1B1B' },
  paymentTotal: { fontSize: 18, fontWeight: '800', color: '#4CAF50', marginBottom: 6 },
  paymentInput: { backgroundColor: '#F5F7FA', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 15 },
  paymentRow: { flexDirection: 'row', gap: 10 },
  payButton: { backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  payButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  cancelPayment: { alignItems: 'center', paddingVertical: 10 },
  cancelPaymentText: { color: '#666', fontWeight: '700' },
});
