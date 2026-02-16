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
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { events as eventsApi } from '../../services/api';

interface Event {
  id: string;
  title: string;
  datetime: string;
  location?: string;
  description?: string;
  inviteLink: string;
  _count?: { guests: number };
}

export default function Events() {
  const [eventsList, setEventsList] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const loadEvents = async () => {
    const result = await eventsApi.list();
    if (result.data) {
      setEventsList(result.data);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const handleCreateEvent = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Fout', 'Titel is verplicht');
      return;
    }

    if (!newDate.trim()) {
      Alert.alert('Fout', 'Datum is verplicht (JJJJ-MM-DD UU:MM formaat)');
      return;
    }

    const datetime = new Date(newDate);
    if (isNaN(datetime.getTime())) {
      Alert.alert('Fout', 'Ongeldig datumformaat');
      return;
    }

    const result = await eventsApi.create({
      title: newTitle.trim(),
      datetime: datetime.toISOString(),
      location: newLocation.trim() || undefined,
    });

    if (result.data) {
      setEventsList([result.data, ...eventsList]);
      setModalVisible(false);
      setNewTitle('');
      setNewDate('');
      setNewLocation('');
    } else {
      Alert.alert('Fout', result.error || 'Aanmaken evenement mislukt');
    }
  };

  const handleShare = async (event: Event) => {
    try {
      await Share.share({
        message: `Je bent uitgenodigd voor ${event.title}!\n\nRSVP hier: ${event.inviteLink}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isPast = (dateStr: string) => new Date(dateStr) < new Date();

  const renderItem = ({ item }: { item: Event }) => (
    <View style={[styles.card, isPast(item.datetime) && styles.cardPast]}>
      <View style={styles.cardHeader}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <TouchableOpacity onPress={() => handleShare(item)} style={styles.shareButton}>
          <Ionicons name="share-outline" size={20} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="time-outline" size={16} color="#6b7280" />
        <Text style={styles.detailText}>{formatDate(item.datetime)}</Text>
      </View>

      {item.location && (
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.location}</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.guestCount}>
          <Ionicons name="people-outline" size={16} color="#6366f1" />
          <Text style={styles.guestCountText}>{item._count?.guests || 0} gasten</Text>
        </View>
        {isPast(item.datetime) && <Text style={styles.pastBadge}>Voorbij</Text>}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={eventsList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Nog geen evenementen</Text>
            <Text style={styles.emptySubtext}>Maak een evenement aan om mensen uit te nodigen</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Evenement aanmaken</Text>

            <TextInput
              style={styles.input}
              placeholder="Titel"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="Datum (JJJJ-MM-DD UU:MM)"
              value={newDate}
              onChangeText={setNewDate}
            />

            <TextInput
              style={styles.input}
              placeholder="Locatie (optioneel)"
              value={newLocation}
              onChangeText={setNewLocation}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setNewTitle('');
                  setNewDate('');
                  setNewLocation('');
                }}
              >
                <Text style={styles.cancelButtonText}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleCreateEvent}>
                <Text style={styles.saveButtonText}>Aanmaken</Text>
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
  list: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardPast: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  shareButton: {
    padding: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  guestCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestCountText: {
    fontSize: 14,
    color: '#6366f1',
    marginLeft: 6,
  },
  pastBadge: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
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
    textAlign: 'center',
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
