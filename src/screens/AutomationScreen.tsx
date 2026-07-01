import React, { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { describeAction } from '../api/automationAgent';
import * as AutomationBridge from '../automation/AutomationBridge';
import { runAutomationTask } from '../automation/agentLoop';
import type { AutomationAction, ScreenState, StepLog } from '../automation/types';
import { SettingsStore } from '../storage';
import { colors } from '../theme';
import type { UiNode } from '../../modules/automation-bridge';

// The default agent (see src/storage/index.ts) uses this model; automation
// doesn't have its own agent-selection UI yet, so it just reuses it.
const AUTOMATION_MODEL = 'claude-sonnet-5';

interface PendingConfirm {
  action: AutomationAction;
}

export default function AutomationScreen() {
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [screenCaptureGranted, setScreenCaptureGranted] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepLog[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const [devTree, setDevTree] = useState<UiNode | null>(null);
  const [devStatus, setDevStatus] = useState('');

  const abortRef = useRef(false);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const refreshPermissions = useCallback(() => {
    setAccessibilityEnabled(AutomationBridge.isAccessibilityServiceEnabled());
    setScreenCaptureGranted(AutomationBridge.hasScreenCapturePermission());
  }, []);

  React.useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  const handleRequestScreenCapture = async () => {
    const granted = await AutomationBridge.requestScreenCapturePermission();
    setScreenCaptureGranted(granted);
  };

  const handleStopScreenCapture = () => {
    AutomationBridge.stopScreenCapture();
    setScreenCaptureGranted(false);
  };

  const handleConfirmRequired = (action: AutomationAction, _screenState: ScreenState): Promise<boolean> =>
    new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setPendingConfirm({ action });
    });

  const respondConfirm = (value: boolean) => {
    setPendingConfirm(null);
    confirmResolverRef.current?.(value);
    confirmResolverRef.current = null;
  };

  const handleStart = async () => {
    const trimmed = instruction.trim();
    if (!trimmed || running) return;

    const settings = await SettingsStore.get();
    abortRef.current = false;
    setSteps([]);
    setRunning(true);
    try {
      await runAutomationTask({
        apiKey: settings.apiKey,
        model: AUTOMATION_MODEL,
        instruction: trimmed,
        onStep: (step) => setSteps((prev) => [...prev, step]),
        onConfirmRequired: handleConfirmRequired,
        isAborted: () => abortRef.current,
      });
    } finally {
      setRunning(false);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
  };

  const handleReadTreeDev = async () => {
    setDevStatus('读取中…');
    try {
      const tree = await AutomationBridge.readUiTree();
      if (!tree) {
        setDevTree(null);
        setDevStatus('无障碍服务未运行，或当前没有活动窗口。');
        return;
      }
      setDevTree(tree);
      setDevStatus('读取成功');
    } catch (error) {
      setDevTree(null);
      setDevStatus(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>无障碍服务</Text>
      <View style={styles.row}>
        <Text style={[styles.statusText, accessibilityEnabled ? styles.ok : styles.warn]}>
          {accessibilityEnabled ? '已开启' : '未开启'}
        </Text>
        <Pressable style={styles.secondaryButton} onPress={refreshPermissions}>
          <Text style={styles.secondaryButtonText}>刷新</Text>
        </Pressable>
      </View>
      {!accessibilityEnabled && (
        <Pressable
          style={styles.saveButton}
          onPress={() => AutomationBridge.openAccessibilitySettings()}
        >
          <Text style={styles.saveButtonText}>去系统设置里开启</Text>
        </Pressable>
      )}

      <Text style={[styles.label, styles.section]}>录屏权限（无障碍树读不到时的兜底）</Text>
      <View style={styles.row}>
        <Text style={[styles.statusText, screenCaptureGranted ? styles.ok : styles.warn]}>
          {screenCaptureGranted ? '已授权' : '未授权'}
        </Text>
      </View>
      <Pressable
        style={styles.saveButton}
        onPress={screenCaptureGranted ? handleStopScreenCapture : handleRequestScreenCapture}
      >
        <Text style={styles.saveButtonText}>{screenCaptureGranted ? '停止录屏' : '请求录屏权限'}</Text>
      </Pressable>

      <Text style={[styles.label, styles.section]}>任务</Text>
      <TextInput
        style={styles.input}
        value={instruction}
        onChangeText={setInstruction}
        placeholder="用一句话描述要做的操作，比如：打开设置查看电量"
        placeholderTextColor={colors.textMuted}
        multiline
        editable={!running}
      />
      <Pressable
        style={[styles.saveButton, running && styles.saveButtonDisabled]}
        onPress={running ? handleStop : handleStart}
      >
        <Text style={styles.saveButtonText}>{running ? '停止' : '开始执行'}</Text>
      </Pressable>

      {steps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>执行日志</Text>
          {steps.map((step) => (
            <View key={step.index} style={styles.stepRow}>
              <Text style={[styles.stepText, step.ok ? styles.ok : styles.warn]}>
                {step.index + 1}. {describeAction(step.action)}
                {step.screenState ? `（${step.screenState.mode === 'tree' ? '语义树' : '截图'}）` : ''}
              </Text>
              {!step.ok && !!step.error && <Text style={styles.hint}>{step.error}</Text>}
            </View>
          ))}
        </View>
      )}

      <View style={styles.devSection}>
        <Text style={styles.label}>开发者工具</Text>
        <Pressable style={styles.secondaryButtonWide} onPress={handleReadTreeDev}>
          <Text style={styles.secondaryButtonText}>手动读取无障碍树</Text>
        </Pressable>
        {!!devStatus && <Text style={styles.hint}>{devStatus}</Text>}
        {devTree && <Text style={styles.treeDump}>{JSON.stringify(devTree, null, 2)}</Text>}
      </View>

      <Modal visible={!!pendingConfirm} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>确认高风险操作</Text>
            <Text style={styles.modalBody}>
              {pendingConfirm ? describeAction(pendingConfirm.action) : ''}
              {'\n'}这个操作看起来涉及支付/删除等敏感内容，确定要继续吗？
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => respondConfirm(false)}>
                <Text style={styles.secondaryButtonText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={() => respondConfirm(true)}>
                <Text style={styles.saveButtonText}>继续</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  secondaryButtonWide: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: { color: colors.text, fontSize: 13 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#141311', fontWeight: '700', fontSize: 16 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  stepRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginTop: 8,
  },
  stepText: { fontSize: 13, fontWeight: '600' },
  devSection: { marginTop: 40, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 },
  treeDump: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  modalBody: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  modalCancel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalConfirm: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
