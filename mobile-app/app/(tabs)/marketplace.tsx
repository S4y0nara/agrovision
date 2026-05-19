import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Dimensions,
  FlatList, TextInput, RefreshControl, ActivityIndicator, Modal, Alert, Platform, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/hooks/CartContext';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { key: 'all', value: 'All' },
  { key: 'fertilizers', value: 'Fertilisants' },
  { key: 'seeds', value: 'Semences' },
  { key: 'tools', value: 'Outils' },
  { key: 'pesticides', value: 'Protection' },
  { key: 'equipment', value: 'Technologie' },
];

interface Product {
  _id?: string;
  id?: string;
  name: string;
  category: string;
  price: string;
  image: string;
  tag?: string;
  desc?: string;
  isOffer?: boolean;
  discount?: string;
  stock?: number;
  rating?: number;
}

export default function MarketplaceScreen() {
  const { t } = useTranslation();
  const { addToCart, cartCount } = useCart();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellForm, setSellForm] = useState({ name: '', category: 'Fertilisants', price: '', description: '', stock: '1' });
  const [sellImage, setSellImage] = useState<string | null>(null);
  const [sellLoading, setSellLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.map((p: any) => ({ ...p, id: p._id || p.id })));
      }
    } catch (e) {
      console.error('Failed to fetch products:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const onRefresh = () => { setRefreshing(true); fetchProducts(); };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tag || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddToCart = (item: Product) => {
    addToCart({ id: item._id || item.id, name: item.name, price: item.price, image: item.image, quantity: 1 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Added to Cart', `${item.name} added!`);
  };

  const pickSellImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setSellImage(result.assets[0].uri);
  };

  const handleSellSubmit = async () => {
    if (!sellForm.name || !sellForm.price || !sellForm.description || !sellImage) {
      Alert.alert('Missing Fields', 'Please fill all fields and add a product photo.');
      return;
    }
    setSellLoading(true);
    try {
      const token = await AsyncStorage.getItem('user_token');
      const formData = new FormData();
      formData.append('name', sellForm.name);
      formData.append('category', sellForm.category);
      formData.append('price', sellForm.price);
      formData.append('description', sellForm.description);
      formData.append('stock', sellForm.stock || '1');
      const fileName = sellImage.split('/').pop() || 'product.jpg';
      formData.append('productImage', { uri: sellImage, type: 'image/jpeg', name: fileName } as any);

      const res = await fetch(`${API_URL}/api/seller/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Request Submitted', 'Your product is waiting for admin approval before it appears in the marketplace.');
        setShowSellModal(false);
        setSellForm({ name: '', category: 'Fertilisants', price: '', description: '', stock: '1' });
        setSellImage(null);
      } else {
        Alert.alert('Error', data.message || 'Failed to publish product.');
      }
    } catch (e) {
      Alert.alert('Connection Error', 'Could not connect to server.');
    } finally {
      setSellLoading(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.productCard} activeOpacity={0.9} onPress={() => setSelectedProduct(item)}>
      <Image source={{ uri: item.image }} style={styles.productImage} />
      {item.tag && (
        <View style={[styles.tag, { backgroundColor: item.isOffer ? '#EF4444' : item.tag === 'Seller' ? '#8B5CF6' : '#FF9800' }]}>
          <Text style={styles.tagText}>{item.isOffer ? `-${item.discount}` : item.tag}</Text>
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{item.price}</Text>
          {item.stock !== undefined && item.stock <= 5 && (
            <Text style={styles.lowStock}>{t('marketplace.onlyLeft', { count: item.stock })}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.addToCartRow} onPress={() => handleAddToCart(item)}>
          <Text style={styles.addToCartText}>{t('marketplace.addToCart')}</Text>
          <Ionicons name="add-circle" size={20} color="#4CAF50" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={20} color="#777" style={styles.searchIcon} />
          <TextInput
          placeholder={t('marketplace.searchPlaceholder')}
            style={styles.searchInput}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/cart')}>
          <Ionicons name="cart-outline" size={24} color="#333" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.categoryChip, activeCategory === cat.value && styles.activeCategoryChip]}
            onPress={() => setActiveCategory(cat.value)}
          >
            <Text style={[styles.categoryText, activeCategory === cat.value && styles.activeCategoryText]}>{t(`marketplace.categories.${cat.key}`)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderProduct}
          keyExtractor={item => item._id || item.id || item.name}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="package-variant" size={48} color="#CCC" />
              <Text style={styles.emptyText}>{t('marketplace.noProducts')}</Text>
            </View>
          }
          ListHeaderComponent={
            filtered.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{filtered.length} {t('marketplace.products')}</Text>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Sell FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowSellModal(true)} activeOpacity={0.85}>
        <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.fabGrad}>
          <Ionicons name="add" size={26} color="#FFF" />
          <Text style={styles.fabText}>{t('marketplace.sell')}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Product Detail Modal */}
      <Modal visible={!!selectedProduct} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHandle} />
            {selectedProduct && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image source={{ uri: selectedProduct.image }} style={styles.detailImage} />
                <View style={styles.detailBody}>
                  {selectedProduct.tag && (
                    <View style={[styles.detailTag, { backgroundColor: selectedProduct.tag === 'Seller' ? '#EDE9FE' : '#FFF7ED' }]}>
                      <Text style={[styles.detailTagText, { color: selectedProduct.tag === 'Seller' ? '#7C3AED' : '#EA580C' }]}>{selectedProduct.tag}</Text>
                    </View>
                  )}
                  <Text style={styles.detailName}>{selectedProduct.name}</Text>
                  <Text style={styles.detailPrice}>{selectedProduct.price}</Text>
                  {selectedProduct.desc && <Text style={styles.detailDesc}>{selectedProduct.desc}</Text>}
                  {selectedProduct.stock !== undefined && (
                    <View style={styles.stockRow}>
                      <Ionicons name="cube-outline" size={16} color="#666" />
                      <Text style={styles.stockText}>{t('marketplace.inStock', { count: selectedProduct.stock })}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.detailAddBtn} onPress={() => { handleAddToCart(selectedProduct); setSelectedProduct(null); }}>
                    <Ionicons name="cart" size={20} color="#FFF" />
                    <Text style={styles.detailAddText}>{t('marketplace.addToCart')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
            <TouchableOpacity style={styles.detailClose} onPress={() => setSelectedProduct(null)}>
              <Ionicons name="close-circle" size={30} color="#CCC" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sell Product Modal */}
      <Modal visible={showSellModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.sellCard}>
            <View style={styles.detailHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.sellHeader}>
                <MaterialCommunityIcons name="store-plus" size={28} color="#7C3AED" />
                <Text style={styles.sellTitle}>{t('marketplace.sellProduct')}</Text>
              </View>
              <Text style={styles.sellSubtitle}>List your product on the AgroVision marketplace</Text>

              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickSellImage}>
                {sellImage ? (
                  <Image source={{ uri: sellImage }} style={styles.sellImagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera-outline" size={32} color="#999" />
                    <Text style={styles.imagePlaceholderText}>Add Product Photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('marketplace.productName')}</Text>
                <TextInput style={styles.formInput} placeholder="e.g. Organic Fertilizer" value={sellForm.name} onChangeText={v => setSellForm(p => ({ ...p, name: v }))} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('support.category')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catPicker}>
                  {CATEGORIES.filter(c => c.value !== 'All').map(c => (
                    <TouchableOpacity key={c.value} style={[styles.catOption, sellForm.category === c.value && styles.catOptionActive]} onPress={() => setSellForm(p => ({ ...p, category: c.value }))}>
                      <Text style={[styles.catOptionText, sellForm.category === c.value && styles.catOptionTextActive]}>{t(`marketplace.categories.${c.key}`)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.formRowGroup}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('marketplace.price')}</Text>
                  <TextInput style={styles.formInput} placeholder="0.00" keyboardType="numeric" value={sellForm.price} onChangeText={v => setSellForm(p => ({ ...p, price: v }))} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('marketplace.stock')}</Text>
                  <TextInput style={styles.formInput} placeholder="1" keyboardType="numeric" value={sellForm.stock} onChangeText={v => setSellForm(p => ({ ...p, stock: v }))} />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('marketplace.description')}</Text>
                <TextInput style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]} placeholder="Describe your product..." multiline value={sellForm.description} onChangeText={v => setSellForm(p => ({ ...p, description: v }))} />
              </View>

              <TouchableOpacity style={styles.publishBtn} onPress={handleSellSubmit} disabled={sellLoading}>
                <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.publishGrad}>
                  {sellLoading ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Ionicons name="rocket-outline" size={18} color="#FFF" />
                      <Text style={styles.publishText}>{t('marketplace.publish')}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity style={styles.detailClose} onPress={() => setShowSellModal(false)}>
              <Ionicons name="close-circle" size={30} color="#CCC" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  searchBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 14, paddingHorizontal: 14, height: 48 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#333' },
  cartBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  cartBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center', borderWidth: 2, borderColor: '#FAFAFA' },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  categoriesContainer: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  categoryChip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: '#F0F0F0', marginRight: 8 },
  activeCategoryChip: { backgroundColor: '#4CAF50' },
  categoryText: { fontWeight: '600', color: '#777', fontSize: 13 },
  activeCategoryText: { color: '#FFF' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#999', fontSize: 14 },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#666', marginBottom: 8 },

  productRow: { justifyContent: 'space-between', marginBottom: 12 },
  productCard: { width: (width - 48) / 2, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  productImage: { width: '100%', height: 140, backgroundColor: '#F5F5F5' },
  tag: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '700', color: '#1B1B1B', marginBottom: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#4CAF50' },
  lowStock: { fontSize: 10, color: '#EF4444', fontWeight: '600' },
  addToCartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  addToCartText: { fontSize: 12, fontWeight: '600', color: '#4CAF50' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#999', fontSize: 15 },

  /* FAB */
  fab: { position: 'absolute', bottom: 90, right: 20, borderRadius: 28, elevation: 8, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  fabGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28 },
  fabText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  /* Product Detail Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%', paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  detailHandle: { width: 40, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginVertical: 12 },
  detailImage: { width: '100%', height: 250, backgroundColor: '#F5F5F5' },
  detailBody: { padding: 20 },
  detailTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  detailTagText: { fontSize: 12, fontWeight: '700' },
  detailName: { fontSize: 22, fontWeight: '800', color: '#1B1B1B', marginBottom: 6 },
  detailPrice: { fontSize: 20, fontWeight: '800', color: '#4CAF50', marginBottom: 12 },
  detailDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  stockText: { fontSize: 13, color: '#666' },
  detailAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', paddingVertical: 16, borderRadius: 14 },
  detailAddText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  detailClose: { position: 'absolute', top: 8, right: 16 },

  /* Sell Modal */
  sellCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  sellHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  sellTitle: { fontSize: 22, fontWeight: '800', color: '#1B1B1B' },
  sellSubtitle: { fontSize: 13, color: '#999', marginBottom: 16, marginTop: 4 },

  imagePickerBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 2, borderColor: '#EDE9FE', borderStyle: 'dashed' },
  sellImagePreview: { width: '100%', height: 180, borderRadius: 14 },
  imagePlaceholder: { height: 140, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#FAFAFE' },
  imagePlaceholderText: { color: '#999', fontWeight: '600' },

  formGroup: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 6 },
  formInput: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#EEE' },
  formRowGroup: { flexDirection: 'row', gap: 12 },
  catPicker: { marginBottom: 4 },
  catOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F5F5F5', marginRight: 8 },
  catOptionActive: { backgroundColor: '#EDE9FE' },
  catOptionText: { fontSize: 12, fontWeight: '600', color: '#777' },
  catOptionTextActive: { color: '#7C3AED' },

  publishBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8, marginBottom: 20, elevation: 4 },
  publishGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  publishText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
