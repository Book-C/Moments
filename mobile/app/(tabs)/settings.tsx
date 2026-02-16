import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth';
import { auth } from '../../services/api';
import { registerForPushNotifications } from '../../services/notifications';

export default function Settings() {
  const { user, logout, setUser } = useAuthStore();
  const [pushEnabled, setPushEnabled] = useState(user?.pushEnabled ?? true);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(user?.emailDigestEnabled ?? true);

  const handleLogout = () => {
    Alert.alert('Uitloggen', 'Weet je zeker dat je wilt uitloggen?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Uitloggen',
        style: 'destructive',
        onPress: async () => {
          // Remove push token on logout
          await auth.removePushToken();
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handlePushToggle = async (value: boolean) => {
    setPushEnabled(value);

    if (value) {
      // Register for push notifications
      const pushToken = await registerForPushNotifications();
      if (pushToken) {
        await auth.registerPushToken(pushToken.token, pushToken.platform as 'ios' | 'android');
      } else {
        // Revert if registration failed
        setPushEnabled(false);
        Alert.alert('Fout', 'Kon pushmeldingen niet inschakelen. Controleer je instellingen.');
        return;
      }
    } else {
      // Remove push token
      await auth.removePushToken();
    }

    const result = await auth.updateSettings({ pushEnabled: value });
    if (result.data && user) {
      setUser({ ...user, pushEnabled: value });
    }
  };

  const handleEmailDigestToggle = async (value: boolean) => {
    setEmailDigestEnabled(value);
    const result = await auth.updateSettings({ emailDigestEnabled: value });
    if (result.data && user) {
      setUser({ ...user, emailDigestEnabled: value });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>E-mail</Text>
              <Text style={styles.rowValue}>{user?.email}</Text>
            </View>
            {user?.emailVerified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.verifiedText}>Geverifieerd</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.verifyButton}>
                <Text style={styles.verifyButtonText}>Verifiëren</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Ionicons name="call-outline" size={20} color="#6b7280" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Telefoon</Text>
              <Text style={styles.rowValue}>{user?.phone || 'Niet ingesteld'}</Text>
            </View>
            {user?.phone && user?.phoneVerified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.verifiedText}>Geverifieerd</Text>
              </View>
            ) : user?.phone ? (
              <TouchableOpacity style={styles.verifyButton}>
                <Text style={styles.verifyButtonText}>Verifiëren</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meldingen</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={20} color="#6b7280" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Pushmeldingen</Text>
            </View>
            <Switch value={pushEnabled} onValueChange={handlePushToggle} trackColor={{ true: '#6366f1' }} />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Wekelijkse e-mail samenvatting</Text>
            </View>
            <Switch value={emailDigestEnabled} onValueChange={handleEmailDigestToggle} trackColor={{ true: '#6366f1' }} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>

        <View style={styles.card}>
          <TouchableOpacity style={styles.row}>
            <Ionicons name="ban-outline" size={20} color="#6b7280" />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Geblokkeerde contacten</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Uitloggen</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Moments v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontSize: 16,
    color: '#111827',
  },
  rowValue: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginLeft: 48,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10b981',
    marginLeft: 4,
  },
  verifyButton: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifyButtonText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    marginLeft: 8,
    fontWeight: '500',
  },
  version: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 24,
  },
});
