import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AutomationBridge from '../../modules/automation-bridge';
import type { UiNode } from '../../modules/automation-bridge';
import { colors } from '../theme';

// Phase 1 manual test screen: no LLM loop yet, just lets you confirm the
// native accessibility bridge actually works on a real device — check
// permission state, read the current screen's tree, and try a click.
export default function AutomationScreen() {
  const [enabled, setEnabled] = useState(false);
  const [tree, setTree] = useState<UiNode | null>(null);
  const [status, setStatus] = useState('');

  const refreshStatus = useCallback(() => {
    setEnabled(AutomationBridge.isAccessibilityServiceEnabled());
  }, []);

  React.useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleReadTree = async () => {
    setStatus('读取中…');
    try {
      const raw = await AutomationBridge.getUiTree();
      if (!raw) {
        setTree(null);
        setStatus('无障碍服务未运行，或当前没有活动窗口。');
        return;
      }
      setTree(JSON.parse(raw) as UiNode);
      setStatus('读取成功');
    } catch (error) {
      setTree(null);
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const countNodes = (node: UiNode): number =>
    1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>无障碍服务</Text>
      <View style={styles.row}>
        <Text style={[styles.statusText, enabled ? styles.ok : styles.warn]}>
          {enabled ? '已开启' : '未开启'}
        </Text>
        <Pressable style={styles.secondaryButton} onPress={refreshStatus}>
          <Text style={styles.secondaryButtonText}>刷新</Text>
        </Pressable>
      </View>
      {!enabled && (
        <Pressable
          style={styles.saveButton}
          onPress={() => AutomationBridge.openAccessibilitySettings()}
        >
          <Text style={styles.saveButtonText}>去系统设置里开启</Text>
        </Pressable>
      )}

      <Text style={[styles.label, styles.section]}>读取当前屏幕</Text>
      <Pressable style={styles.saveButton} onPress={handleReadTree}>
        <Text style={styles.saveButtonText}>读取无障碍树</Text>
      </Pressable>
      {!!status && <Text style={styles.hint}>{status}</Text>}
      {tree && (
        <Text style={styles.hint}>
          共 {countNodes(tree)} 个节点，可点击节点数：{' '}
          {tree.children.length > 0 ? '见下方原始 JSON' : 0}
        </Text>
      )}
      {tree && <Text style={styles.treeDump}>{JSON.stringify(tree, null, 2)}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6, marginTop: 8 },
  section: { marginTop: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusText: { fontSize: 15, fontWeight: '700' },
  ok: { color: colors.accent },
  warn: { color: colors.danger },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  secondaryButtonText: { color: colors.text, fontSize: 13 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: { color: '#141311', fontWeight: '700', fontSize: 16 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 10, lineHeight: 18 },
  treeDump: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
  },
});
