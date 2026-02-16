import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { people, celebrations, addresses, identities } from '../../services/api';

interface Person {
  id: string;
  displayName: string;
  relationshipTag?: string;
  notes?: string;
  identities: Array<{
    id: string;
    sourceType: string;
    normalizedPhone?: string;
    normalizedEmail?: string;
    username?: string;
  }>;
  addresses: Array<{
    id: string;
    label: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
  }>;
  celebrations: Array<{
    id: string;
    type: string;
    title?: string;
    date: string;
  }>;
}

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebrationModal, setCelebrationModal] = useState(false);
  const [celebrationType, setCelebrationType] = useState<'BIRTHDAY' | 'ANNIVERSARY' | 'LIFE_EVENT'>('BIRTHDAY');
  const [celebrationDate, setCelebrationDate] = useState('');
  const [celebrationTitle, setCelebrationTitle] = useState('');

  const loadPerson = async () => {
    if (!id) return;
    const result = await people.get(id);
    if (result.data) {
      setPerson(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPerson();
  }, [id]);

  const handleDelete = () => {
    Alert.alert('Persoon verwijderen', `Weet je zeker dat je ${person?.displayName} wilt verwijderen?`, [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const result = await people.delete(id);
          if (result.data) {
            router.back();
          } else {
            Alert.alert('Fout', 'Verwijderen mislukt');
          }
        },
      },
    ]);
  };

  const handleAddCelebration = async () => {
    if (!celebrationDate) {
      Alert.alert('Fout', 'Datum is verplicht');
      return;
    }

    if (celebrationType === 'LIFE_EVENT' && !celebrationTitle) {
      Alert.alert('Fout', 'Titel is verplicht voor life events');
      return;
    }

    const date = new Date(celebrationDate);
    if (isNaN(date.getTime())) {
      Alert.alert('Fout', 'Ongeldig datumformaat');
      return;
    }

    const result = await celebrations.create({
      personId: id!,
      type: celebrationType,
      date: date.toISOString(),
      title: celebrationType === 'LIFE_EVENT' ? celebrationTitle : undefined,
    });

    if (result.data) {
      setCelebrationModal(false);
      setCelebrationDate('');
      setCelebrationTitle('');
      loadPerson();
    } else {
      Alert.alert('Fout', result.error || 'Toevoegen mislukt');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Laden...</Text>
      </View>
    );
  }

  if (!person) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Persoon niet gevonden</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {person.displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </Text>
        </View>
        <Text style={styles.name}>{person.displayName}</Text>
        {person.relationshipTag && <Text style={styles.tag}>{person.relationshipTag}</Text>}
      </View>

      {person.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notities</Text>
          <View style={styles.card}>
            <Text style={styles.notesText}>{person.notes}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Momenten</Text>
          <TouchableOpacity onPress={() => setCelebrationModal(true)}>
            <Ionicons name="add-circle-outline" size={24} color="#6366f1" />
          </TouchableOpacity>
        </View>
        {person.celebrations.length > 0 ? (
          <View style={styles.card}>
            {person.celebrations.map((c, i) => (
              <View key={c.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.celebrationRow}>
                  <Ionicons
                    name={c.type === 'BIRTHDAY' ? 'gift' : c.type === 'ANNIVERSARY' ? 'heart' : 'star'}
                    size={20}
                    color="#6366f1"
                  />
                  <View style={styles.celebrationContent}>
                    <Text style={styles.celebrationType}>
                      {c.title || (c.type === 'BIRTHDAY' ? 'verjaardag' : c.type === 'ANNIVERSARY' ? 'jubileum' : 'life event')}
                    </Text>
                    <Text style={styles.celebrationDate}>{formatDate(c.date)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Nog geen momenten toegevoegd</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contactgegevens</Text>
        {person.identities.length > 0 ? (
          <View style={styles.card}>
            {person.identities.map((identity, i) => (
              <View key={identity.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.identityRow}>
                  <Ionicons
                    name={
                      identity.sourceType === 'PHONE'
                        ? 'call'
                        : identity.sourceType === 'EMAIL'
                        ? 'mail'
                        : 'person'
                    }
                    size={20}
                    color="#6b7280"
                  />
                  <Text style={styles.identityText}>
                    {identity.normalizedPhone ||
                      identity.normalizedEmail ||
                      identity.username ||
                      identity.sourceType}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Nog geen contactgegevens toegevoegd</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Adressen</Text>
        {person.addresses.length > 0 ? (
          <View style={styles.card}>
            {person.addresses.map((addr, i) => (
              <View key={addr.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.addressRow}>
                  <Ionicons name="location" size={20} color="#6b7280" />
                  <View style={styles.addressContent}>
                    <Text style={styles.addressLabel}>{addr.label}</Text>
                    <Text style={styles.addressText}>
                      {addr.street}, {addr.city}, {addr.postalCode}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Nog geen adressen toegevoegd</Text>
        )}
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
        <Text style={styles.deleteButtonText}>Persoon verwijderen</Text>
      </TouchableOpacity>

      <Modal visible={celebrationModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Moment toevoegen</Text>

            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.typeButtons}>
              {(['BIRTHDAY', 'ANNIVERSARY', 'LIFE_EVENT'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, celebrationType === type && styles.typeButtonActive]}
                  onPress={() => setCelebrationType(type)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      celebrationType === type && styles.typeButtonTextActive,
                    ]}
                  >
                    {type === 'BIRTHDAY' ? 'Verjaardag' : type === 'ANNIVERSARY' ? 'Jubileum' : 'Life Event'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {celebrationType === 'LIFE_EVENT' && (
              <TextInput
                style={styles.input}
                placeholder="Titel (bijv. Afstuderen)"
                value={celebrationTitle}
                onChangeText={setCelebrationTitle}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Datum (JJJJ-MM-DD)"
              value={celebrationDate}
              onChangeText={setCelebrationDate}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setCelebrationModal(false);
                  setCelebrationDate('');
                  setCelebrationTitle('');
                }}
              >
                <Text style={styles.cancelButtonText}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddCelebration}>
                <Text style={styles.saveButtonText}>Toevoegen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
  },
  tag: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  notesText: {
    padding: 16,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  celebrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  celebrationContent: {
    marginLeft: 12,
  },
  celebrationType: {
    fontSize: 16,
    color: '#111827',
    textTransform: 'capitalize',
  },
  celebrationDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  identityText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
  },
  addressRow: {
    flexDirection: 'row',
    padding: 16,
  },
  addressContent: {
    marginLeft: 12,
    flex: 1,
  },
  addressLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  addressText: {
    fontSize: 16,
    color: '#111827',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    marginBottom: 40,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#ef4444',
    marginLeft: 8,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 8,
  },
  typeButtonActive: {
    backgroundColor: '#6366f1',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
