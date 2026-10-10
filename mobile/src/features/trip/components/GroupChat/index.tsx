import React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ChatHeader } from './ChatHeader';
import { QuickActions } from './QuickActions';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export const GroupChatFeature = () => {
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ChatHeader />
      <QuickActions />
      <MessageList />
      <ChatInput />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});
