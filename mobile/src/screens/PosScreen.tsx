// @ts-nocheck
import { useContext, useEffect, useState } from "react";
import { DeviceEventEmitter, Platform } from "react-native";
import { TapSoundContext } from "../components/TapPressable";
import { useAppScreenContext } from "./AppScreenContext";
import { StoreSwitcher } from "./StoreSwitcher";

const EXTERNAL_KEYBOARD_EVENT = "externalKeyboardKey";

const keyboardDigitMap: Record<string, string> = {
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

export function PosScreen() {
  const playTapSound = useContext(TapSoundContext);
  const [keyboardPressedKey, setKeyboardPressedKey] = useState<string | null>(
    null,
  );
  const [posProductsPaneWidth, setPosProductsPaneWidth] = useState(0);
  const {
    DraggableGrid,
    LocalProduct,
    MISC_CART_ITEM_ID,
    MISC_CART_ITEM_NAME,
    PosProductGridItem,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    activateAmountMode,
    activateMultiply,
    activePosProductKey,
    addMiscAmountToCart,
    addProductToCart,
    addRentAmountToCart,
    addTawasiSupplyFromPad,
    applyDiscountFromPad,
    backspacePad,
    buttonDisabled,
    cancelCurrentOrder,
    cancelOrderButton,
    cancelOrderButtonText,
    carryInAmount,
    cart,
    cartItemName,
    cartItemPrice,
    cartItemQty,
    cartItemRow,
    cartListContainer,
    cartListScroll,
    clearPad,
    d7b3c4,
    data,
    decimal,
    decreaseProductInCart,
    delayLongPress,
    disabled,
    discountInput,
    dragHandle,
    dragHintText,
    emptyText,
    formatMoney,
    formatQuantity,
    handlePosProductDragEnd,
    id,
    index,
    inputFull,
    isDisabled,
    isMiscItem,
    isPosProductReordering,
    isPosSplit,
    isRefundMode,
    item,
    itemHeight,
    key,
    keyboardType,
    length,
    map,
    name,
    nestedScrollEnabled,
    normalized,
    numColumns,
    numberOfLines,
    onChangeText,
    onDragItemActive,
    onDragRelease,
    onDragStart,
    onPress,
    orderRowMeta,
    pad,
    padActionButton,
    padActionButtonDanger,
    padActionButtonPrimary,
    padActionRow,
    padActionText,
    padActionTextPrimary,
    padAmountPreview,
    padClearButton,
    padClearText,
    padDisplayBox,
    padDisplayLabel,
    padDisplayValue,
    padGrid,
    padKey,
    padKeyText,
    padMetaRow,
    padMetaText,
    pendingMultiplier,
    placeholder,
    placeholderTextColor,
    posControlPane,
    posControlPaneMobile,
    posPadInput,
    posPadSection,
    posProductColumns,
    posProductGridData,
    posProductItemHeight,
    posProducts,
    posProductsGrid,
    posProductsPane,
    posProductsPaneMobile,
    posSection,
    posSectionTitle,
    posWorkspace,
    posWorkspaceMobile,
    previous,
    price,
    priceLabel,
    primaryButton,
    primaryButtonText,
    productCardCompact,
    productCardCompactMobile,
    productCardDragging,
    productCardHeadRow,
    productName,
    productPrice,
    productTapArea,
    productTapAreaDragging,
    pushPadToken,
    quantity,
    renderItem,
    rest,
    roundPadValue,
    section,
    sectionTitle,
    setActivePosProductKey,
    setDiscountInput,
    setIsPosProductReordering,
    setIsRefundMode,
    smallButtonGhostCompact,
    smallButtonGhostText,
    style,
    styles,
    submitOrder,
    subtotal,
    summaryRow,
    summaryText,
    summaryTextStrong,
    total,
    value,
    x,
  } = useAppScreenContext() as any;

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = DeviceEventEmitter.addListener(
      EXTERNAL_KEYBOARD_EVENT,
      (event: { action?: string; key?: string }) => {
        const key = event.key ?? "";

        if (event.action === "up") {
          setKeyboardPressedKey((current) => (current === key ? null : current));
          return;
        }

        if (key === "BACKSPACE") {
          backspacePad();
        } else if (key === "CLEAR") {
          clearPad();
        } else if (key === "." || /^\d$/.test(key)) {
          pushPadToken(key);
        } else {
          return;
        }

        playTapSound();
        setKeyboardPressedKey(key);
      },
    );

    return () => subscription.remove();
  }, [backspacePad, clearPad, playTapSound, pushPadToken]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    const getPadCommand = (event: KeyboardEvent) => {
      const digit = keyboardDigitMap[event.key];
      if (digit) {
        return digit;
      }

      if (event.key === "." || event.code === "NumpadDecimal") {
        return ".";
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        return "BACKSPACE";
      }

      if (event.key === "Escape") {
        return "CLEAR";
      }

      return null;
    };

    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return (
        element?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName ?? "")
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const command = getPadCommand(event);
      if (!command) {
        return;
      }

      event.preventDefault();
      if (command === "BACKSPACE") {
        backspacePad();
      } else if (command === "CLEAR") {
        clearPad();
      } else {
        pushPadToken(command);
      }
      playTapSound();
      setKeyboardPressedKey(command);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const command = getPadCommand(event);
      if (command) {
        setKeyboardPressedKey((current) =>
          current === command ? null : current,
        );
      }
    };

    const clearKeyboardPressedKey = () => setKeyboardPressedKey(null);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearKeyboardPressedKey);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearKeyboardPressedKey);
    };
  }, [backspacePad, clearPad, playTapSound, pushPadToken]);

  return (
<View
                    style={[
                      styles.posWorkspace,
                      !isPosSplit && styles.posWorkspaceMobile,
                    ]}
                  >
                    <View
                      style={[
                        styles.posProductsColumn,
                        !isPosSplit && styles.posProductsColumnMobile,
                      ]}
                    >
                      <StoreSwitcher />
                    <View
                      style={[
                        styles.section,
                        styles.posSection,
                        styles.posProductsPane,
                        !isPosSplit && styles.posProductsPaneMobile,
                      ]}
                      onLayout={(event) => {
                        const nextWidth = Math.round(
                          event.nativeEvent.layout.width,
                        );
                        setPosProductsPaneWidth((current) =>
                          current === nextWidth ? current : nextWidth,
                        );
                      }}
                    >
                      <Text
                        style={[styles.sectionTitle, styles.posSectionTitle]}
                      >
                        منتجات سريعة
                      </Text>
                      {posProducts.length === 0 ? (
                        <Text style={styles.emptyText}>
                          لا يوجد منتجات بعد. أضف منتجات من صفحة التوريدات.
                        </Text>
                      ) : (
                        <>
                          <Text style={styles.orderRowMeta}>
                            اضغط للإضافة. ضغط مطوّل على البطاقة نفسها للسحب الحر
                            وتغيير الترتيب.
                          </Text>
                          {posProductsPaneWidth > 0 && (
                            <DraggableGrid
                              key={`pos-products-${posProductColumns}-${posProductsPaneWidth}`}
                              numColumns={posProductColumns}
                              data={posProductGridData}
                              renderItem={(item: PosProductGridItem) => {
                              const isMiscItem =
                                item.id === MISC_CART_ITEM_ID ||
                                item.name === MISC_CART_ITEM_NAME;
                              const priceLabel = isMiscItem
                                ? "سعر متغير"
                                : formatMoney(item.price);
                              const isDisabled = isPosProductReordering;

                              return (
                                <View
                                  style={[
                                    styles.productCardCompact,
                                    !isPosSplit &&
                                      styles.productCardCompactMobile,
                                    activePosProductKey === item.id &&
                                      styles.productCardDragging,
                                  ]}
                                >
                                  <View style={styles.productCardHeadRow}>
                                    <View style={styles.dragHandle}>
                                      <Text style={styles.dragHintText}>
                                        سحب
                                      </Text>
                                    </View>
                                    <Pressable
                                      style={styles.smallButtonGhostCompact}
                                      onPress={() =>
                                        decreaseProductInCart(item.id)
                                      }
                                      disabled={isDisabled || isMiscItem}
                                    >
                                      <Text style={styles.smallButtonGhostText}>
                                        -
                                      </Text>
                                    </Pressable>
                                  </View>
                                  <Pressable
                                    style={[
                                      styles.productTapArea,
                                      isDisabled &&
                                        styles.productTapAreaDragging,
                                    ]}
                                    onPress={() => {
                                      if (isDisabled) {
                                        return;
                                      }
                                      if (isMiscItem) {
                                        addMiscAmountToCart();
                                        return;
                                      }
                                      addProductToCart(item.id);
                                    }}
                                    disabled={isDisabled}
                                  >
                                    <Text
                                      style={styles.productName}
                                      numberOfLines={2}
                                    >
                                      {item.name}
                                    </Text>
                                    <Text style={styles.productPrice}>
                                      {priceLabel}
                                    </Text>
                                  </Pressable>
                                </View>
                              );
                              }}
                              onDragStart={() => {
                                setIsPosProductReordering(true);
                              }}
                              onDragItemActive={(item: PosProductGridItem) => {
                                setIsPosProductReordering(true);
                                setActivePosProductKey(item.id);
                              }}
                              onDragRelease={(data: PosProductGridItem[]) => {
                                setIsPosProductReordering(false);
                                setActivePosProductKey(null);
                                const normalized = data.map(
                                  ({ key, ...rest }: PosProductGridItem) =>
                                    rest as LocalProduct,
                                );
                                handlePosProductDragEnd({ data: normalized });
                              }}
                              itemHeight={posProductItemHeight}
                              style={[
                                styles.posProductsGrid,
                                {
                                  minHeight:
                                    Math.ceil(
                                      posProducts.length / posProductColumns,
                                    ) * posProductItemHeight,
                                },
                              ]}
                              delayLongPress={140}
                            />
                          )}
                        </>
                      )}
                    </View>
                    </View>

                    <View
                      style={[
                        styles.posControlPane,
                        !isPosSplit && styles.posControlPaneMobile,
                      ]}
                    >
                      <View
                        style={[
                          styles.section,
                          styles.posSection,
                          styles.posPadSection,
                        ]}
                      >
                        <Text
                          style={[styles.sectionTitle, styles.posSectionTitle]}
                        >
                          لوحة البيع
                        </Text>
                        <View style={styles.padDisplayBox}>
                          <Text style={styles.padDisplayLabel}>
                            الإدخال الحالي
                          </Text>
                          <Text style={styles.padDisplayValue}>
                            {posPadInput || "0"}
                          </Text>
                        </View>
                        <View style={styles.padMetaRow}>
                          <Text style={styles.padMetaText}>
                            الوضع: {isRefundMode ? "إرجاع" : "بيع"}
                          </Text>
                          <Text style={styles.padMetaText}>
                            كمية:{" "}
                            {pendingMultiplier && pendingMultiplier > 0
                              ? formatQuantity(pendingMultiplier)
                              : "1"}
                          </Text>
                        </View>
                        <View style={styles.padMetaRow}>
                          <Text style={styles.padMetaText}>
                            مبلغ:{" "}
                            {padAmountPreview
                              ? formatMoney(padAmountPreview)
                              : "-"}
                          </Text>
                        </View>
                        <View style={styles.padMetaRow}>
                          <Text style={styles.padMetaText}>
                            كاش مدور: +{formatMoney(carryInAmount)}
                          </Text>
                        </View>

                        <View style={styles.padGrid}>
                          {[
                            "7",
                            "8",
                            "9",
                            "4",
                            "5",
                            "6",
                            "1",
                            "2",
                            "3",
                            "00",
                            "0",
                            ".",
                          ].map((key) => (
                            <Pressable
                              key={key}
                              style={[
                                styles.padKey,
                                keyboardPressedKey === key &&
                                  styles.padKeyKeyboardPressed,
                              ]}
                              onPress={() => pushPadToken(key)}
                            >
                              <Text style={styles.padKeyText}>{key}</Text>
                            </Pressable>
                          ))}
                        </View>

                        <View style={styles.padActionRow}>
                          <Pressable
                            style={styles.padActionButton}
                            onPress={applyDiscountFromPad}
                          >
                            <Text style={styles.padActionText}>حسم+</Text>
                          </Pressable>
                          <Pressable
                            style={styles.padActionButton}
                            onPress={addMiscAmountToCart}
                          >
                            <Text style={styles.padActionText}>المنوعات</Text>
                          </Pressable>
                          <Pressable
                            style={styles.padActionButton}
                            onPress={addRentAmountToCart}
                          >
                            <Text style={styles.padActionText}>أجار</Text>
                          </Pressable>
                          <Pressable
                            style={styles.padActionButton}
                            onPress={() => void addTawasiSupplyFromPad()}
                          >
                            <Text style={styles.padActionText}>
                              تواصي
                            </Text>
                          </Pressable>
                        </View>
                        <View style={styles.padActionRow}>
                          <Pressable
                            style={styles.padActionButton}
                            onPress={roundPadValue}
                          >
                            <Text style={styles.padActionText}>مدور</Text>
                          </Pressable>
                          <Pressable
                            style={styles.padActionButtonPrimary}
                            onPress={activateMultiply}
                          >
                            <Text style={styles.padActionTextPrimary}>ضرب</Text>
                          </Pressable>
                          <Pressable
                            style={styles.padActionButtonPrimary}
                            onPress={activateAmountMode}
                          >
                            <Text style={styles.padActionTextPrimary}>
                              مبلغ
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.padActionButton,
                              isRefundMode && styles.padActionButtonDanger,
                            ]}
                            onPress={() =>
                              setIsRefundMode((previous) => !previous)
                            }
                          >
                            <Text style={styles.padActionText}>إرجاع</Text>
                          </Pressable>
                        </View>
                        <Pressable
                          style={[
                            styles.padClearButton,
                            keyboardPressedKey === "BACKSPACE" &&
                              styles.padKeyKeyboardPressed,
                          ]}
                          onPress={backspacePad}
                        >
                          <Text style={styles.padClearText}>حذف رقم</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.padClearButton,
                            keyboardPressedKey === "CLEAR" &&
                              styles.padKeyKeyboardPressed,
                          ]}
                          onPress={clearPad}
                        >
                          <Text style={styles.padClearText}>مسح</Text>
                        </Pressable>
                      </View>

                      <View style={[styles.section, styles.posSection]}>
                        <Text
                          style={[styles.sectionTitle, styles.posSectionTitle]}
                        >
                          سلة الطلب
                        </Text>
                        <View style={styles.cartListContainer}>
                          {cart.length === 0 ? (
                            <Text style={styles.emptyText}>
                              لا يوجد عناصر في السلة.
                            </Text>
                          ) : (
                            <ScrollView
                              style={styles.cartListScroll}
                              nestedScrollEnabled
                            >
                              {cart.map((item, index) => (
                                <View
                                  key={`${item.id}-${index}`}
                                  style={styles.cartItemRow}
                                >
                                  <Text style={styles.cartItemName}>
                                    {item.name}
                                  </Text>
                                  <Text style={styles.cartItemQty}>
                                    x{formatQuantity(item.quantity)}
                                  </Text>
                                  <Text style={styles.cartItemPrice}>
                                    {formatMoney(
                                      item.lineTotal ??
                                        item.price * item.quantity,
                                    )}
                                  </Text>
                                </View>
                              ))}
                            </ScrollView>
                          )}
                        </View>

                        <TextInput
                          style={styles.inputFull}
                          value={discountInput}
                          onChangeText={setDiscountInput}
                          keyboardType="decimal-pad"
                          placeholder="حسم+"
                          placeholderTextColor="#d7b3c4"
                        />

                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryText}>
                            المجموع الفرعي: {formatMoney(subtotal)}
                          </Text>
                          <Text style={styles.summaryTextStrong}>
                            الإجمالي: {formatMoney(total)}
                          </Text>
                        </View>

                        <Pressable
                          style={styles.primaryButton}
                          onPress={() => void submitOrder()}
                        >
                          <Text style={styles.primaryButtonText}>
                            {isRefundMode ? "تسجيل إرجاع" : "حفظ الطلب"}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.cancelOrderButton,
                            cart.length === 0 && styles.buttonDisabled,
                          ]}
                          disabled={cart.length === 0}
                          onPress={cancelCurrentOrder}
                        >
                          <Text style={styles.cancelOrderButtonText}>
                            إلغاء الطلب
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
  );
}
