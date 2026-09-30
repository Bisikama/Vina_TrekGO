import {
  SymbolView,
  type SymbolViewProps,
} from 'expo-symbols';
import { Text } from 'react-native';

type AppSymbolProps = {
  name: SymbolViewProps['name'];
  color: string;
  size?: number;
};

export function AppSymbol({
  name,
  color,
  size = 22,
}: AppSymbolProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      fallback={
        <Text
          style={{
            color,
            fontSize: size,
          }}
        >
          •
        </Text>
      }
    />
  );
}