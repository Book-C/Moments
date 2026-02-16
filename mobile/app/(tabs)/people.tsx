import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { people as peopleApi } from '../../services/api';

interface Person {
  id: string;
  displayName: string;
  relationshipTag?: string;
  notes?: string;
  identities: any[];
  celebrations: any[];
}

export default function People() {
  const [peopleList, setPeopleList] = useState<Person[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');

  const loadPeople = async () => {
    const result = await peopleApi.list();
    if (result.data) {
      setPeopleList(result.data);
    }
  };

  useEffect(() => {
    loadPeople();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPeople();
    setRefreshing(false);
  };

  const handleAddPerson = async () => {
    if (!newName.trim()) {
      Alert.alert('Fout', 'Naam is verplicht');
      return;
    }

    const result = await peopleApi.create({
      displayName: newName.trim(),
      relationshipTag: newTag.trim() || undefined,
    });

    if (result.data) {
      setPeopleList([...peopleList, result.data]);
      setModalVisible(false);
      setNewName('');
      setNewTag('');
    } else {
      Alert.alert('Fout', result.error || 'Aanmaken mislukt');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderItem = ({ item }: { item: Person }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/people/${item.id}`)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(item.displayName)}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.personName}>{item.displayName}</Text>
        {item.relationshipTag && (
          <View style={styles.tagContainer}>
            <Text style={styles.tag}>{item.relationshipTag}</Text>
          </View>
        )}
      </View>
      <View style={styles.badges}>
        {item.celebrations?.length > 0 && (
          <View style={styles.badge}>
            <Ionicons name="gift" size={14} color="#6366f1" />
            <Text style={styles.badgeText}>{item.celebrations.length}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Personen</Text>
        <TouchableOpacity
          style={styles.importButton}
          onPress={() => router.push('/contacts/import')}
        >
          <Ionicons name="download-outline" size={18} color="#6366f1" />
          <Text style={styles.importButtonText}>Importeren</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={peopleList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Nog geen personen</Text>
            <Text style={styles.emptySubtext}>Voeg iemand toe of importeer contacten</Text>
            <TouchableOpacity
              style={styles.importEmptyButton}
              onPress={() => router.push('/contacts/import')}
            >
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.importEmptyButtonText}>Contacten importeren</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Persoon toevoegen</Text>

            <TextInput
              style={styles.input}
              placeholder="Naam"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="Relatie (bijv. vriend, familie)"
              value={newTag}
              onChangeText={setNewTag}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setNewName('');
                  setNewTag('');
                }}
              >
                <Text style={styles.cancelButtonText}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddPerson}>
                <Text style={styles.saveButtonText}>Toevoegen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    gap: 4,
  },
  importButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardContent: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  tagContainer: {
    marginTop: 4,
  },
  tag: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  badges: {
    flexDirection: 'row',
    marginRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: '#6366f1',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  importEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    gap: 8,
  },
  importEmptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
