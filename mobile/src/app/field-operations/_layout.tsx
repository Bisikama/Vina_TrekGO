import { Colors } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function FieldOperationsLayout() {
    return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.surface } }} />;
}