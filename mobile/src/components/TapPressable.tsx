import {
  ComponentProps,
  createContext,
  forwardRef,
  useContext,
} from "react";
import { Pressable as RNPressable } from "react-native";

export const TapSoundContext = createContext<() => void>(() => undefined);

type AppPressableProps = ComponentProps<typeof RNPressable>;

export const Pressable = forwardRef<any, AppPressableProps>((props, ref) => {
  const playTapSound = useContext(TapSoundContext);
  const { onPress, ...rest } = props;

  const handlePress: AppPressableProps["onPress"] = (event) => {
    playTapSound();
    onPress?.(event);
  };

  return <RNPressable ref={ref} onPress={handlePress} {...rest} />;
});
