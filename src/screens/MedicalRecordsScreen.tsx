import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import RecordCard from '../components/RecordCard';
import recordsService from '../services/records';
import type { MedicalDocument } from '../types';

export default function MedicalRecordsScreen() {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<MedicalDocument | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await recordsService.listDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        await uploadFile(asset.uri, asset.name, asset.mimeType || 'application/pdf');
      }
    } catch (err) {
      console.error('Document pick error:', err);
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const name = `photo_${Date.now()}.jpg`;
        await uploadFile(asset.uri, name, 'image/jpeg');
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const handlePickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Gallery permission is required');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const name = `image_${Date.now()}.jpg`;
        await uploadFile(asset.uri, name, 'image/jpeg');
      }
    } catch (err) {
      console.error('Gallery error:', err);
    }
  };

  const uploadFile = async (uri: string, name: string, type: string) => {
    setLoading(true);
    try {
      await recordsService.upload({ uri, name, type });
      Alert.alert('Uploaded', 'Your document is being processed with OCR. It will appear in your records shortly.');
      await loadDocuments();
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (doc: MedicalDocument) => {
    Alert.alert(
      'Delete Record',
      `Are you sure you want to delete "${doc.fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await recordsService.deleteDocument(doc._id);
              await loadDocuments();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  if (selectedDoc) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => setSelectedDoc(null)}>
          <Text style={styles.backText}>← Back to Records</Text>
        </TouchableOpacity>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedDoc.fileName}</Text>
          <Text style={styles.detailDate}>
            Uploaded: {new Date(selectedDoc.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {selectedDoc.structuredData?.tests && selectedDoc.structuredData.tests.length > 0 && (
          <View style={styles.testsCard}>
            <Text style={styles.testsTitle}>Extracted Lab Results</Text>
            {selectedDoc.structuredData.tests.map((test, i) => (
              <View key={i} style={styles.testRow}>
                <Text style={styles.testName}>{test.name}</Text>
                <View style={styles.testValues}>
                  <Text style={styles.testValue}>{test.value} {test.unit}</Text>
                  {test.referenceRange && (
                    <Text style={styles.testRef}>Ref: {test.referenceRange}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedDoc.structuredData?.diagnosis && selectedDoc.structuredData.diagnosis.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Diagnosis</Text>
            {selectedDoc.structuredData.diagnosis.map((d, i) => (
              <Text key={i} style={styles.sectionItem}>- {d}</Text>
            ))}
          </View>
        )}

        {selectedDoc.structuredData?.medications && selectedDoc.structuredData.medications.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Medications</Text>
            {selectedDoc.structuredData.medications.map((m, i) => (
              <Text key={i} style={styles.sectionItem}>- {m}</Text>
            ))}
          </View>
        )}

        {selectedDoc.extractedText ? (
          <View style={styles.rawTextCard}>
            <Text style={styles.rawTextTitle}>Raw Extracted Text</Text>
            <Text style={styles.rawText}>{selectedDoc.extractedText}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(selectedDoc)}>
          <Text style={styles.deleteText}>Delete Record</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Medical Records</Text>
        <Text style={styles.subtitle}>Upload reports for analysis via OCR</Text>
      </View>

      <View style={styles.uploadSection}>
        <Text style={styles.uploadTitle}>Upload a Report</Text>
        <View style={styles.uploadButtons}>
          <TouchableOpacity style={styles.uploadButton} onPress={handleTakePhoto} disabled={loading}>
            <Text style={styles.uploadLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadButton} onPress={handlePickFromGallery} disabled={loading}>
            <Text style={styles.uploadLabel}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadButton} onPress={handlePickDocument} disabled={loading}>
            <Text style={styles.uploadLabel}>File</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator style={{ marginTop: 12 }} color="#FFFFFF" />}
      </View>

      <View style={styles.ocrInfo}>
        <Text style={styles.ocrInfoText}>
          Documents are processed with OCR (Google Cloud Vision) and structured for analysis.
          Extracted lab values, diagnoses, and medications feed into your health chat for personalized advice.
        </Text>
      </View>

      <Text style={styles.listTitle}>
        Your Records ({documents.length})
      </Text>

      {documents.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No records uploaded yet</Text>
          <Text style={styles.emptySubtext}>
            Upload lab reports, prescriptions, or discharge summaries to get personalized analysis.
          </Text>
        </View>
      ) : (
        documents.map((doc) => (
          <RecordCard
            key={doc._id}
            document={doc}
            onPress={() => setSelectedDoc(doc)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 16, backgroundColor: '#000000' },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontFamily: 'HelveticaNeue-Light' },
  uploadSection: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  uploadTitle: { fontSize: 16, fontWeight: '400', color: '#FFFFFF', marginBottom: 16, fontFamily: 'HelveticaNeue' },
  uploadButtons: { flexDirection: 'row', justifyContent: 'space-around' },
  uploadButton: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  uploadLabel: { fontSize: 14, color: '#FFFFFF', fontWeight: '400', fontFamily: 'HelveticaNeue-Light' },
  ocrInfo: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  ocrInfoText: { fontSize: 12, color: '#FFFFFF', lineHeight: 18, fontFamily: 'HelveticaNeue-Light' },
  listTitle: { fontSize: 16, fontWeight: '400', color: '#FFFFFF', marginBottom: 12, fontFamily: 'HelveticaNeue' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  emptySubtext: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8, lineHeight: 18, paddingHorizontal: 24, fontFamily: 'HelveticaNeue-Light' },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '400', fontFamily: 'HelveticaNeue-Light' },
  detailCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  detailTitle: { fontSize: 18, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue' },
  detailDate: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontFamily: 'HelveticaNeue-Light' },
  testsCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  testsTitle: { fontSize: 16, fontWeight: '400', color: '#FFFFFF', marginBottom: 12, fontFamily: 'HelveticaNeue' },
  testRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  testName: { fontSize: 14, color: '#FFFFFF', flex: 1, fontFamily: 'HelveticaNeue-Light' },
  testValues: { alignItems: 'flex-end' },
  testValue: { fontSize: 15, fontWeight: '400', color: '#FFFFFF', fontFamily: 'HelveticaNeue-Light' },
  testRef: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontFamily: 'HelveticaNeue-Light' },
  sectionCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sectionTitle: { fontSize: 16, fontWeight: '400', color: '#FFFFFF', marginBottom: 8, fontFamily: 'HelveticaNeue' },
  sectionItem: { fontSize: 14, color: '#FFFFFF', marginBottom: 4, lineHeight: 20, fontFamily: 'HelveticaNeue-Light' },
  rawTextCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  rawTextTitle: { fontSize: 14, fontWeight: '400', color: '#FFFFFF', marginBottom: 8, fontFamily: 'HelveticaNeue' },
  rawText: { fontSize: 12, color: '#FFFFFF', lineHeight: 18, fontFamily: 'HelveticaNeue-Light' },
  deleteButton: { alignItems: 'center', paddingVertical: 16, marginBottom: 40 },
  deleteText: { fontSize: 15, color: '#ef4444', fontWeight: '400', fontFamily: 'HelveticaNeue-Light' },
});
