import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

export const ROLE = { human: 'human', ai: 'ai' };
const BLINK_MS = 420;

function AIBadge() {
  return (
    <View style={styles.aiBadgeOuter}>
      <Text style={styles.aiBadgeIcon}>📍</Text>
    </View>
  );
}

// Memoized so streaming tokens re-render only the live bubble, not every
// finished message's Markdown tree.
const MessageBubble = memo(function MessageBubble({ role, content }) {
  const isHuman = role === ROLE.human;
  return (
    <View style={[styles.bubbleRow, isHuman ? styles.userRow : styles.aiRow]}>
      {isHuman ? null : <AIBadge />}
      <View style={[styles.bubble, isHuman ? styles.userBubble : styles.aiBubble]}>
        <Markdown style={markdownStyles}>{content}</Markdown>
      </View>
    </View>
  );
});

// Owns its own timer so the blink doesn't re-render the whole chat.
function BlinkingCursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), BLINK_MS);
    return () => clearInterval(t);
  }, []);
  return <Text style={[styles.cursor, !on && styles.cursorHidden]}>📍</Text>;
}

function ErrorBox({ title, body, style }) {
  return (
    <View style={[styles.errorBox, style]}>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorBody}>{body}</Text>
    </View>
  );
}

// The conversation: messages, the live streaming bubble, and the input row.
// onSend() returns true when it sent a typed message.
export default function ChatView({
  messages,
  loading,
  streaming,
  streamText,
  error,
  map3DError,
  userEmail,
  canSend,
  input,
  onChangeInput,
  onSend,
  onLogout,
  onOpenProfile,
}) {
  const scrollRef = useRef(null);
  const [inputHeight, setInputHeight] = useState(40);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamText, loading]);

  const send = () => {
    if (onSend()) setInputHeight(40);
  };

  if (!messages.length && !streaming) {
    return (
      <View style={styles.centerState}>
        {error ? (
          <ErrorBox title="Chat connection failed" body={error} />
        ) : map3DError ? (
          <ErrorBox title="3D map disabled" body={map3DError} />
        ) : (
          <>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.signedInHint}>Signed in as {userEmail}. Chat stays off until you add an API key.</Text>
            <Pressable onPress={onLogout}>
              <Text style={styles.linkText}>Log out</Text>
            </Pressable>
            <Pressable onPress={onOpenProfile}>
              <Text style={styles.linkText}>Profile</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const inputEnabled = !streaming && canSend;

  return (
    <>
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {messages.map((m, idx) => (
          <MessageBubble key={`${m.role}-${idx}`} role={m.role} content={m.content} />
        ))}

        {loading && !streaming ? (
          <View style={[styles.bubbleRow, styles.aiRow]}>
            <AIBadge />
            <View style={[styles.bubble, styles.loaderBubble]}>
              <View style={styles.loaderPulse} />
            </View>
          </View>
        ) : null}

        {streaming ? (
          <View style={[styles.bubbleRow, styles.aiRow]}>
            <AIBadge />
            <View style={[styles.bubble, styles.aiBubble]}>
              <View style={styles.streamingRow}>
                <View style={styles.streamingMarkdown}>
                  <Markdown style={markdownStyles}>{streamText || ' '}</Markdown>
                </View>
                <BlinkingCursor />
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {error ? <ErrorBox title="Chat connection failed" body={error} style={{ marginHorizontal: 8, marginBottom: 4 }} /> : null}

      <Pressable onPress={onOpenProfile} style={{ paddingHorizontal: 12, paddingTop: 8 }}>
        <Text style={styles.linkText}>Profile · {userEmail}</Text>
      </Pressable>

      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              height: Math.max(40, Math.min(108, inputHeight)),
              borderRadius: inputHeight > 54 ? 8 : 999,
            },
          ]}
          value={input}
          onChangeText={onChangeInput}
          onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height + 8)}
          multiline
          placeholder="Ask the tour guide..."
          placeholderTextColor="#9ca3af"
          editable={inputEnabled}
          autoFocus={false}
          onSubmitEditing={() => {
            if (inputEnabled) send();
          }}
          blurOnSubmit={false}
        />
        <Pressable
          style={[styles.sendButton, inputEnabled ? null : styles.sendButtonDisabled]}
          onPress={send}
          disabled={!inputEnabled}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(127,29,29,0.45)',
    borderColor: '#7f1d1d',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    maxWidth: 360,
  },
  errorTitle: { color: '#fecaca', fontWeight: '700', marginBottom: 4 },
  errorBody: { color: '#fee2e2' },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 8, paddingVertical: 10, gap: 8 },
  bubbleRow: { flexDirection: 'row', marginVertical: 4, marginRight: 8 },
  aiRow: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  aiBadgeOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBadgeIcon: { fontSize: 16 },
  bubble: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiBubble: { backgroundColor: 'transparent' },
  userBubble: {
    backgroundColor: '#374151',
    borderRadius: 999,
    paddingHorizontal: 14,
  },
  loaderBubble: { backgroundColor: '#111827', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 },
  loaderPulse: {
    width: 80,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#374151',
  },
  streamingRow: { flexDirection: 'row', alignItems: 'flex-end' },
  streamingMarkdown: { flex: 1, minWidth: 0 },
  cursor: { marginLeft: 4, color: '#fff' },
  cursorHidden: { opacity: 0 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
  sendButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontSize: 15 },
  signedInHint: { color: '#cbd5e1', textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  linkText: { color: '#93c5fd', textAlign: 'center', marginTop: 12 },
});

const markdownStyles = {
  body: { color: '#e5e7eb', fontSize: 15, lineHeight: 21 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  heading3: { color: '#f8fafc', marginBottom: 6, fontWeight: '700', fontSize: 18 },
  list_item: { color: '#e5e7eb' },
  code_inline: { backgroundColor: '#0f172a', color: '#c7d2fe', borderRadius: 4 },
  code_block: { backgroundColor: '#0f172a', color: '#c7d2fe', borderRadius: 8, padding: 8 },
  fence: { backgroundColor: '#0f172a', color: '#c7d2fe', borderRadius: 8, padding: 8 },
  link: { color: '#93c5fd' },
};
