import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import chatService from '../services/chat';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import type { ChatSession } from '../types';
import { SIZES } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChatHistoryScreenProps {
  onBack: () => void;
  onNavigateMenu: () => void;
}

/* Group sessions by date, pinned always first */
function groupByDate(
  sessions: ChatSession[],
): { label: string; items: ChatSession[] }[] {
  const pinned = sessions.filter((s) => s.pinned);
  const unpinned = sessions.filter((s) => !s.pinned);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { [key: string]: ChatSession[] } = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  };

  unpinned.forEach((s) => {
    const d = new Date(s.updatedAt);
    if (d >= today) groups.Today.push(s);
    else if (d >= yesterday) groups.Yesterday.push(s);
    else if (d >= weekAgo) groups['This Week'].push(s);
    else groups.Older.push(s);
  });

  const result: { label: string; items: ChatSession[] }[] = [];

  if (pinned.length > 0) {
    result.push({ label: 'Pinned', items: pinned });
  }

  Object.entries(groups)
    .filter(([_, items]) => items.length > 0)
    .forEach(([label, items]) => result.push({ label, items }));

  return result;
}

function getSessionTitle(session: ChatSession): string {
  // Use chatTitle if available, otherwise fallback to summary, then first message
  const title = (session as any).chatTitle || session.summary;
  
  if (title && title.trim().length > 0 && title !== 'New conversation') {
    return title.trim();
  }
  
  // Fallback to first user message
  const firstUserMessage = session.messages?.find((m) => m.role === 'user')?.content;
  if (firstUserMessage && firstUserMessage.trim().length > 0) {
    return firstUserMessage.trim().substring(0, 50);
  }
  
  return 'Untitled conversation';
}

export default function ChatHistoryScreen({
  onBack,
  onNavigateMenu,
}: ChatHistoryScreenProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { setSessionId, setMessages } = useChatStore();
  const { user } = useAuthStore();

  /* ── Menu state ── */
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 16 });

  /* ── Rename modal state ── */
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await chatService.getHistory(1, 50);
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const openSession = async (session: ChatSession) => {
    try {
      // Load full session data with messages
      const full = await chatService.getSession(session._id);
      
      // Ensure messages are properly loaded - handle both array and undefined cases
      const messages = full.messages || session.messages || [];
      
      // IMPORTANT: Set sessionId and messages together synchronously
      // This ensures ChatScreen receives both at the same time
      setSessionId(session._id);
      
      // Set the chat title from session summary if available
      const title = full.summary || session.summary;
      if (title && title.trim().length > 0 && title !== 'New conversation') {
        useChatStore.getState().setChatTitle(title.trim());
      }
      
      setMessages(messages);
      
      // Small delay to ensure state is updated before navigation
      // This prevents race conditions with App.tsx clearing chat
      setTimeout(() => {
        onBack();
      }, 100);
    } catch (err) {
      console.error('Failed to load session:', err);
      // Even on error, try to use messages from the session object if available
      setSessionId(session._id);
      
      // Set title on error fallback too
      const title = session.summary;
      if (title && title.trim().length > 0 && title !== 'New conversation') {
        useChatStore.getState().setChatTitle(title.trim());
      }
      
      const fallbackMessages = session.messages || [];
      if (fallbackMessages.length > 0) {
        setMessages(fallbackMessages);
      } else {
        setMessages([]);
      }
      setTimeout(() => {
        onBack();
      }, 100);
    }
  };

  /* ── Three-dot menu actions ── */
  const openMenu = (sessionId: string, pageY: number) => {
    setMenuSessionId(sessionId);
    setMenuPosition({ top: pageY - 10, right: 16 });
  };

  const closeMenu = () => setMenuSessionId(null);

  const getMenuSession = (): ChatSession | undefined =>
    sessions.find((s) => s._id === menuSessionId);

  /* ── Rename ── */
  const handleRenameStart = () => {
    const session = getMenuSession();
    if (!session) return;
    closeMenu();
    setRenameSessionId(session._id);
    setRenameText(getSessionTitle(session));
    setRenameModalVisible(true);
  };

  const handleRenameSave = async () => {
    if (!renameSessionId || !renameText.trim()) return;
    setRenameSaving(true);
    try {
      await chatService.renameSession(renameSessionId, renameText.trim());
      setSessions((prev) =>
        prev.map((s) =>
          s._id === renameSessionId
            ? { ...s, summary: renameText.trim() }
            : s,
        ),
      );
      setRenameModalVisible(false);
    } catch {
      Alert.alert('Error', 'Could not rename this chat.');
    } finally {
      setRenameSaving(false);
    }
  };

  /* ── Pin / Unpin ── */
  const handleTogglePin = async () => {
    const session = getMenuSession();
    if (!session) return;
    closeMenu();
    try {
      const result = await chatService.togglePinSession(session._id);
      setSessions((prev) =>
        prev.map((s) =>
          s._id === session._id ? { ...s, pinned: result.pinned } : s,
        ),
      );
    } catch {
      Alert.alert('Error', 'Could not update pin status.');
    }
  };

  /* ── Delete ── */
  const handleDelete = () => {
    const session = getMenuSession();
    if (!session) return;
    closeMenu();

    const title = getSessionTitle(session);
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.deleteSession(session._id);
              setSessions((prev) =>
                prev.filter((s) => s._id !== session._id),
              );
              if (
                useChatStore.getState().currentSessionId === session._id
              ) {
                useChatStore.getState().clearChat();
              }
            } catch {
              Alert.alert(
                'Error',
                'Could not delete this chat. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  const grouped = groupByDate(sessions);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Chat History</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : sessions.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons
            name="chatbubbles-outline"
            size={48}
            color="rgba(255,255,255,0.5)"
          />
          <Text style={s.emptyTitle}>No conversations yet</Text>
          <Text style={s.emptyDesc}>
            Start a new chat and your conversations will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        >
          {grouped.map((group) => (
            <View key={group.label}>
              <Text style={s.groupLabel}>
                {group.label === 'Pinned' ? 'PINNED' : group.label}
              </Text>
              {group.items.map((session) => (
                <View key={session._id} style={s.sessionRow}>
                  <TouchableOpacity
                    style={s.sessionItem}
                    onPress={() => openSession(session)}
                    activeOpacity={0.7}
                  >
                    <View style={s.sessionIconWrap}>
                      <Ionicons
                        name={
                          session.pinned
                            ? 'pin-outline'
                            : 'chatbubble-outline'
                        }
                        size={16}
                        color={
                          session.pinned
                            ? '#FFFFFF'
                            : 'rgba(255,255,255,0.5)'
                        }
                      />
                    </View>
                    <View style={s.sessionInfo}>
                      <Text style={s.sessionTitle} numberOfLines={1}>
                        {getSessionTitle(session)}
                      </Text>
                      <Text style={s.sessionMeta}>
                        {(session as any).messageCount ||
                          session.messages?.length ||
                          0}{' '}
                        messages •{' '}
                        {new Date(session.updatedAt).toLocaleTimeString(
                          [],
                          { hour: '2-digit', minute: '2-digit' },
                        )}
                        {session.finalPrescription && session.finalPrescription.length > 0 && (
                          <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '400' }}> • 💊 Prescription</Text>
                        )}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Three-dot menu trigger */}
                  <TouchableOpacity
                    style={s.moreBtn}
                    onPress={(e) => {
                      const y = (e.nativeEvent as any).pageY ?? 200;
                      openMenu(session._id, y);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={18}
                      color="rgba(255,255,255,0.5)"
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Bottom user bar + menu */}
      <View style={s.bottomBar}>
        <View style={s.userInfo}>
          {user?.profileImage ? (
            <Image
              source={{ uri: user.profileImage }}
              style={s.userAvatarImg}
            />
          ) : (
            <View style={s.userAvatarCircle}>
              <Text style={s.userAvatarText}>
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={s.userName} numberOfLines={1}>
            {user?.name || 'User'}
          </Text>
        </View>

        <TouchableOpacity
          style={s.menuBtn}
          onPress={onNavigateMenu}
          activeOpacity={0.7}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* ─── Context Menu Modal ─── */}
      <Modal
        visible={menuSessionId !== null}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={s.menuOverlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <View style={s.menuCard}>
            {/* Rename */}
            <TouchableOpacity
              style={s.menuItem}
              onPress={handleRenameStart}
              activeOpacity={0.7}
            >
              <Text style={s.menuItemText}>Rename</Text>
            </TouchableOpacity>

            {/* Pin / Unpin */}
            <TouchableOpacity
              style={s.menuItem}
              onPress={handleTogglePin}
              activeOpacity={0.7}
            >
              <Text style={s.menuItemText}>
                {getMenuSession()?.pinned ? 'Unpin' : 'Pin'}
              </Text>
            </TouchableOpacity>

            <View style={s.menuDivider} />

            {/* Delete */}
            <TouchableOpacity
              style={s.menuItem}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Text style={[s.menuItemText, s.menuItemTextDanger]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Rename Modal ─── */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={s.renameOverlay}>
          <View style={s.renameCard}>
            <Text style={s.renameTitle}>Rename Chat</Text>
            <TextInput
              style={s.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Enter new name"
              placeholderTextColor="#C0C0C0"
              autoFocus
              maxLength={100}
              selectTextOnFocus
            />
            <View style={s.renameBtnRow}>
              <TouchableOpacity
                style={s.renameCancelBtn}
                onPress={() => setRenameModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={s.renameCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.renameSaveBtn,
                  !renameText.trim() && { opacity: 0.4 },
                ]}
                onPress={handleRenameSave}
                disabled={renameSaving || !renameText.trim()}
                activeOpacity={0.8}
              >
                {renameSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.renameSaveTxt}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 28,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#000000',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.xl,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue',
  },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#000000',
  },
  emptyTitle: {
    fontSize: SIZES.xl,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: SIZES.md,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'HelveticaNeue-Light',
  },
  list: { flex: 1, backgroundColor: '#000000' },
  listContent: { padding: 16, paddingBottom: 40, backgroundColor: '#000000' },
  groupLabel: {
    fontSize: SIZES.sm,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'HelveticaNeue',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#000000',
  },
  sessionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  sessionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sessionInfo: { flex: 1 },
  sessionTitle: {
    fontSize: SIZES.base,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    marginBottom: 2,
  },
  sessionMeta: {
    fontSize: SIZES.xs,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'HelveticaNeue-Light',
  },

  /* Three-dot button */
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  /* ── Context Menu Modal ── */
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 8,
    width: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
  },
  menuItemTextDanger: {
    color: '#ef4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    marginVertical: 4,
  },

  /* ── Rename Modal ── */
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  renameCard: {
    backgroundColor: '#111111',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue',
    marginBottom: 16,
  },
  renameInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'HelveticaNeue-Light',
    marginBottom: 20,
  },
  renameBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  renameCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  renameCancelTxt: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'HelveticaNeue-Light',
  },
  renameSaveBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  renameSaveTxt: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'HelveticaNeue',
  },

  /* Bottom user bar */
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userAvatarText: {
    color: '#000000',
    fontSize: SIZES.sm,
    fontWeight: '400',
    fontFamily: 'HelveticaNeue',
  },
  userName: {
    fontSize: SIZES.md,
    color: '#FFFFFF',
    fontWeight: '400',
    fontFamily: 'HelveticaNeue-Light',
    maxWidth: 160,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
