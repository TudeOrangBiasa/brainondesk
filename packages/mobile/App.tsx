import { markdownToPlainText } from '@inkeep/open-knowledge-core/markdown/plain-text';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

const SAMPLE_MARKDOWN = '# BrainOnDesk\n\n**Lokal** di perangkat.';

export default function App() {
  const plainText = markdownToPlainText(SAMPLE_MARKDOWN);
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>BrainOnDesk</Text>
      <Text selectable style={styles.body}>
        {plainText}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
  },
});
