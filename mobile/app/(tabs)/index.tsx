import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { celebrations } from '../../services/api';

interface Celebration {
  id: string;
  type: string;
  title?: string;
  date: string;
  nextDate: string;
  person: {
    displayName: string;
  };
}

export default function Home() {
  const [upcoming, setUpcoming] = useState<Celebration[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUpcoming = async () => {
    const result = await celebrations.getUpcoming();
    if (result.data) {
      setUpcoming(result.data);
      setError(null);
    } else {
      setError(result.error || 'Laden mislukt');
    }
  };

  useEffect(() => {
    loadUpcoming();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUpcoming();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Vandaag';
    if (diff === 1) return 'Morgen';
    return `Over ${diff} dagen`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'BIRTHDAY':
        return 'gift';
      case 'ANNIVERSARY':
        return 'heart';
      default:
        return 'star';
    }
  };

  const renderItem = ({ item }: { item: Celebration }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons name={getIcon(item.type) as any} size={24} color="#6366f1" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.personName}>{item.person.displayName}</Text>
        <Text style={styles.celebrationType}>
          {item.title || item.type.toLowerCase().replace('_', ' ')}
        </Text>
      </View>
      <View style={styles.dateContainer}>
        <Text style={styles.daysUntil}>{getDaysUntil(item.nextDate)}</Text>
        <Text style={styles.date}>{formatDate(item.nextDate)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Binnenkort</Text>
        <Text style={styles.subtitle}>Komende 30 dagen</Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadUpcoming}>
            <Text style={styles.retryText}>Tik om opnieuw te proberen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={upcoming}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>Geen komende momenten</Text>
              <Text style={styles.emptySubtext}>Voeg verjaardagen en jubilea toe aan je personen</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  celebrationType: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  daysUntil: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  retryText: {
    fontSize: 14,
    color: '#6366f1',
    marginTop: 8,
  },
});
