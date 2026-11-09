import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

// The overlay frame for the chat: a left column on wide screens, a bottom
// sheet on phones that rides above the keyboard.
export default function ChatPanel({ isDesktopLayout, children }) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOpen(true);
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const panelPositionStyle = isDesktopLayout
    ? { left: 0, bottom: 0, top: 0, width: '34%', padding: 16 }
    : {
        left: 0,
        right: 0,
        bottom: keyboardOpen ? keyboardHeight : 0,
        height: keyboardOpen ? '62%' : '50%',
        paddingHorizontal: 8,
        paddingBottom: 10,
      };

  return (
    <KeyboardAvoidingView
      style={[styles.chatWrap, panelPositionStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.chatPanel}>{children}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chatWrap: {
    position: 'absolute',
  },
  chatPanel: {
    flex: 1,
    backgroundColor: 'rgba(31,41,55,0.90)',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
