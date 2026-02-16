import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { people, identities, celebrations } from '../../services/api';

interface PhoneContact {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phones: string[];
  emails: string[];
  birthday?: Date;
  selected: boolean;
}

export default function ImportContacts() {
  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    // Web doesn't support contacts
    if (Platform.OS === 'web') {
      setLoading(false);
      Alert.alert('Niet beschikbaar', 'Contact import is alleen beschikbaar op mobiele apparaten');
      return;
    }

    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Birthday,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      const mappedContacts: PhoneContact[] = data
        .filter(contact => contact.name) // Only contacts with names
        .map(contact => ({
          id: contact.id || Math.random().toString(),
          name: contact.name || '',
          firstName: contact.firstName,
          lastName: contact.lastName,
          phones: contact.phoneNumbers?.map(p => p.number || '').filter(Boolean) || [],
          emails: contact.emails?.map(e => e.email || '').filter(Boolean) || [],
          birthday: contact.birthday ? new Date(
            contact.birthday.year || new Date().getFullYear(),
            (contact.birthday.month || 1) - 1,
            contact.birthday.day || 1
          ) : undefined,
          selected: false,
        }));

      setContacts(mappedContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Fout', 'Kon contacten niet laden');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setContacts(prev =>
      prev.map(c => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const selectAll = () => {
    const allSelected = contacts.every(c => c.selected);
    setContacts(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  };

  const getSelectedCount = () => contacts.filter(c => c.selected).length;

  const handleImport = async () => {
    const selected = contacts.filter(c => c.selected);

    if (selected.length === 0) {
      Alert.alert('Geen selectie', 'Selecteer minimaal 1 contact om te importeren');
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const contact of selected) {
      try {
        // Create person
        const personResult = await people.create({
          displayName: contact.name,
          relationshipTag: 'contact',
        });

        if (!personResult.data) {
          errorCount++;
          continue;
        }

        const personId = personResult.data.id;

        // Add phone identities
        for (const phone of contact.phones) {
          await identities.add({
            personId,
            sourceType: 'PHONE',
            phone,
          });
        }

        // Add email identities
        for (const email of contact.emails) {
          await identities.add({
            personId,
            sourceType: 'EMAIL',
            email,
          });
        }

        // Add birthday if available
        if (contact.birthday) {
          await celebrations.create({
            personId,
            type: 'BIRTHDAY',
            date: contact.birthday.toISOString(),
          });
        }

        successCount++;
      } catch (error) {
        console.error('Error importing contact:', contact.name, error);
        errorCount++;
      }
    }

    setImporting(false);

    if (errorCount === 0) {
      Alert.alert(
        'Import voltooid',
        `${successCount} ${successCount === 1 ? 'contact' : 'contacten'} succesvol geïmporteerd`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } else {
      Alert.alert(
        'Import voltooid',
        `${successCount} gelukt, ${errorCount} mislukt`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  const renderContact = ({ item }: { item: PhoneContact }) => (
    <TouchableOpacity
      style={[styles.contactRow, item.selected && styles.contactRowSelected]}
      onPress={() => toggleSelect(item.id)}
    >
      <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
        {item.selected && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <View style={styles.contactDetails}>
          {item.phones.length > 0 && (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={12} color="#6b7280" />
              <Text style={styles.detailText}>{item.phones[0]}</Text>
            </View>
          )}
          {item.emails.length > 0 && (
            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={12} color="#6b7280" />
              <Text style={styles.detailText}>{item.emails[0]}</Text>
            </View>
          )}
          {item.birthday && (
            <View style={styles.detailRow}>
              <Ionicons name="gift-outline" size={12} color="#6b7280" />
              <Text style={styles.detailText}>
                {item.birthday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Contacten laden...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="lock-closed-outline" size={48} color="#d1d5db" />
        <Text style={styles.errorTitle}>Geen toegang</Text>
        <Text style={styles.errorText}>
          Geef toegang tot je contacten in de instellingen van je telefoon
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadContacts}>
          <Text style={styles.retryButtonText}>Opnieuw proberen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="phone-portrait-outline" size={48} color="#d1d5db" />
        <Text style={styles.errorTitle}>Niet beschikbaar</Text>
        <Text style={styles.errorText}>
          Contact import is alleen beschikbaar op mobiele apparaten
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Terug</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Contacten importeren</Text>
        <TouchableOpacity onPress={selectAll} style={styles.selectAllButton}>
          <Text style={styles.selectAllText}>
            {contacts.every(c => c.selected) ? 'Deselecteer' : 'Selecteer alles'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        renderItem={renderContact}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Geen contacten gevonden</Text>
          </View>
        }
      />

      {contacts.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.importButton, importing && styles.importButtonDisabled]}
            onPress={handleImport}
            disabled={importing || getSelectedCount() === 0}
          >
            {importing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.importButtonText}>
                  {getSelectedCount() > 0
                    ? `Importeer ${getSelectedCount()} ${getSelectedCount() === 1 ? 'contact' : 'contacten'}`
                    : 'Selecteer contacten'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectAllText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  contactRowSelected: {
    backgroundColor: '#eef2ff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  contactDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6b7280',
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
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  importButtonDisabled: {
    opacity: 0.6,
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
