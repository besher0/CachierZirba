// @ts-nocheck
import { Text, View } from "react-native";

import { styles } from "../views/appStyles";
import { useAppShellContext } from "./AppScreenContext";

export function StoreSwitcher() {
  const {
    Pressable,
    assignedStoreId,
    canSwitchStore,
    selectedStoreId,
    setSelectedStoreId,
    stores,
  } = useAppShellContext();

  return (
    <View style={styles.storeRow}>
      {stores.map((store) => {
        const isSelected = selectedStoreId === store.id;
        const disabled = !canSwitchStore && store.id !== assignedStoreId;
        return (
          <Pressable
            key={store.id}
            disabled={!canSwitchStore}
            onPress={() => {
              if (canSwitchStore) {
                setSelectedStoreId(store.id);
              }
            }}
            style={[
              styles.storeChip,
              isSelected && styles.storeChipSelected,
              disabled && styles.storeChipDisabled,
            ]}
          >
            <Text
              style={[
                styles.storeChipText,
                isSelected && styles.storeChipTextSelected,
                disabled && styles.storeChipTextDisabled,
              ]}
            >
              {store.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
