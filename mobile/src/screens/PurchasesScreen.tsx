// @ts-nocheck
import { SectionList } from "react-native";

import { useAppScreenContext } from "./AppScreenContext";

export function PurchasesScreen() {
  const {
    DateTimePicker,
    Modal,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
    beginProductEdit,
    canManageInventory,
    clearPurchaseDateFilters,
    closePurchaseDatePicker,
    confirmPurchaseDatePicker,
    deleteProductDefinition,
    exportPurchasesData,
    formatMoney,
    formatQuantity,
    isAdmin,
    isProductFormOpen,
    isRefreshingActiveScreen,
    isSavingSupplyPayment,
    isSavingTawasi,
    newProductCostPriceInput,
    newProductNameInput,
    newProductSellPriceInput,
    newProductUnitType,
    openSelectedPurchasesInvoice,
    openTodayPurchasesInvoice,
    openPurchaseDatePicker,
    openProductCreateForm,
    onPurchaseDatePickerChange,
    productEditingId,
    productSupplyRows,
    purchaseDatePickerTarget,
    purchaseDatePickerValue,
    purchaseFilterFrom,
    purchaseFilterProduct,
    purchaseFilterTo,
    purchaseHistorySummaryRows,
    purchaseInvoiceDateInput,
    receiveTodaySupplies,
    refreshActiveScreenData,
    registerSupplyPayment,
    registerTawasiSupply,
    resetProductForm,
    saveProductDefinition,
    setActiveScreen,
    setNewProductCostPriceInput,
    setNewProductNameInput,
    setNewProductSellPriceInput,
    setNewProductUnitType,
    setPurchaseFilterProduct,
    setPurchaseInvoiceDateInput,
    setStatusMessage,
    setSupplyPaymentAmountInput,
    setSupplyPaymentNoteInput,
    setTawasiCapitalInput,
    setTawasiNoteInput,
    setTawasiSellPriceInput,
    styles,
    supplyPaymentAmountInput,
    supplyPaymentNoteInput,
    tawasiCapitalInput,
    tawasiNoteInput,
    tawasiSellPriceInput,
    todaySupplyInputs,
    updateTodaySupplyInput,
  } = useAppScreenContext() as any;

  const sections = [
    { key: "supply", data: productSupplyRows },
    { key: "history", data: purchaseHistorySummaryRows },
  ];

  return (
    <>
      <SectionList
        style={styles.flexOne}
        contentContainerStyle={styles.content}
        sections={sections}
        keyExtractor={(item, index) =>
          item.key ?? item.productId ?? item.clientPurchaseId ?? `${index}`
        }
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      removeClippedSubviews
      updateCellsBatchingPeriod={50}
      windowSize={7}
      refreshing={isRefreshingActiveScreen}
      onRefresh={() =>
        void refreshActiveScreenData({ force: true, showIndicator: true })
      }
      renderSectionHeader={({ section }) =>
        section.key === "supply" ? (
          <>
            <View style={styles.supplyColumnsHeader}>
              <Text style={styles.supplyColumnsHeaderText}>المنتج</Text>
              <Text style={styles.supplyColumnsHeaderText}>المتبقي</Text>
              <Text style={styles.supplyColumnsHeaderText}>نزل اليوم</Text>
            </View>
            {section.data.length === 0 ? (
              <View style={styles.supplyEmptyState}>
                <Text style={styles.emptyText}>لا توجد منتجات بعد.</Text>
                <Pressable
                  style={[
                    styles.addProductCtaButton,
                    !canManageInventory && styles.buttonDisabled,
                  ]}
                  disabled={!canManageInventory}
                  onPress={openProductCreateForm}
                >
                  <Text style={styles.addProductCtaButtonText}>إضافة أول منتج</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeaderInline}>
              <Text style={styles.sectionTitle}>سجل المشتريات</Text>
              <Pressable
                style={styles.smallRefreshButton}
                onPress={() => void exportPurchasesData()}
              >
                <Text style={styles.smallRefreshText}>تصدير CSV</Text>
              </Pressable>
            </View>
            <View style={styles.inputRow}>
              <Pressable
                style={styles.input}
                onPress={() => openPurchaseDatePicker("from")}
              >
                <Text
                  style={
                    purchaseFilterFrom
                      ? styles.datePickerInputText
                      : styles.datePickerInputPlaceholder
                  }
                >
                  {purchaseFilterFrom || "من تاريخ"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.input}
                onPress={() => openPurchaseDatePicker("to")}
              >
                <Text
                  style={
                    purchaseFilterTo
                      ? styles.datePickerInputText
                      : styles.datePickerInputPlaceholder
                  }
                >
                  {purchaseFilterTo || "إلى تاريخ"}
                </Text>
              </Pressable>
            </View>
            <View style={styles.rowActionButtons}>
              <Pressable
                style={styles.smallRefreshButton}
                onPress={clearPurchaseDateFilters}
              >
                <Text style={styles.smallRefreshText}>مسح التاريخ</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.inputFull}
              value={purchaseFilterProduct}
              onChangeText={setPurchaseFilterProduct}
              placeholder="فلترة باسم المنتج"
              placeholderTextColor="#d7b3c4"
            />
            {section.data.length === 0 ? (
              <Text style={styles.emptyText}>لا توجد كميات مشتريات.</Text>
            ) : null}
          </View>
        )
      }
      renderSectionFooter={({ section }) =>
        section.key === "supply" ? (
          <View style={styles.sectionActions}>
            {!isProductFormOpen ? (
              <Pressable
                style={[
                  styles.addProductInlineButton,
                  !canManageInventory && styles.buttonDisabled,
                ]}
                disabled={!canManageInventory}
                onPress={openProductCreateForm}
              >
                <Text style={styles.addProductInlineButtonText}>إضافة منتج جديد</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.primaryButton,
                !canManageInventory && styles.buttonDisabled,
              ]}
              disabled={!canManageInventory}
              onPress={() => void receiveTodaySupplies()}
            >
              <Text style={styles.primaryButtonText}>تثبيت توريدات اليوم</Text>
            </Pressable>
          </View>
        ) : null
      }
      renderItem={({ item, section }) =>
        section.key === "supply" ? (
          <View style={styles.supplyRow}>
            <View style={styles.orderRowMain}>
              <Text style={styles.orderRowId}>{item.name}</Text>
              <Text style={styles.orderRowMeta}>
                {item.unitType === "KG" ? "يباع بالكيلو" : "يباع بالقطعة"}
              </Text>
            </View>
            <View style={styles.orderRowMain}>
              <Text style={styles.orderRowMeta}>مبيع: {formatMoney(item.sellPrice)}</Text>
              <Text style={styles.orderRowMeta}>رأس المال: {formatMoney(item.costPrice)}</Text>
            </View>
            <View style={styles.supplyFieldsRow}>
              <View style={styles.supplyField}>
                <Text style={styles.supplyFieldLabel}>العدد المتبقي</Text>
                <TextInput
                  style={[styles.input, styles.supplyReadonlyInput]}
                  value={`${item.remainingQty}`}
                  editable={false}
                  selectTextOnFocus={false}
                />
              </View>
              <View style={styles.supplyField}>
                <Text style={styles.supplyFieldLabel}>نزل اليوم</Text>
                <TextInput
                  style={styles.input}
                  value={todaySupplyInputs[item.productId] ?? ""}
                  onChangeText={(value) =>
                    updateTodaySupplyInput(item.productId, value)
                  }
                  keyboardType="decimal-pad"
                  placeholder="أدخل الكمية"
                  placeholderTextColor="#d7b3c4"
                />
                <Text style={styles.supplyLoggedTodayText}>
                  المسجل اليوم: {item.loggedToday}
                </Text>
              </View>
            </View>
            {canManageInventory ? (
              <View style={styles.rowActionButtons}>
                <Pressable
                  style={styles.smallRefreshButton}
                  onPress={() => beginProductEdit(item.productId)}
                >
                  <Text style={styles.smallRefreshText}>تعديل المنتج</Text>
                </Pressable>
                {isAdmin ? (
                  <Pressable
                    style={styles.dangerButton}
                    onPress={() => deleteProductDefinition(item.productId)}
                  >
                    <Text style={styles.dangerButtonText}>حذف المنتج</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.orderRow}>
            <View style={styles.orderRowMain}>
              <Text style={styles.orderRowId}>{item.productName}</Text>
              <Text style={styles.orderRowItems}>
                الكمية: {formatQuantity(item.quantity)}
              </Text>
            </View>
            <View style={styles.orderRowMain}>
              <Text style={styles.orderRowTotal}>{formatMoney(item.totalCost)}</Text>
              <Text style={item.synced ? styles.syncedText : styles.pendingText}>
                {item.synced ? "متزامن" : `${item.pendingCount} معلق`}
              </Text>
            </View>
            <Text style={styles.orderRowMeta}>
              {item.firstPurchaseDate === item.lastPurchaseDate
                ? item.firstPurchaseDate
                : `${item.firstPurchaseDate} - ${item.lastPurchaseDate}`}
              {item.purchaseDatesCount > 1 ? ` | ${item.purchaseDatesCount} أيام` : ""}
            </Text>
            <Text style={styles.orderRowMeta}>
              متوسط رأس المال: {formatMoney(item.unitCost)}
            </Text>
            {item.purchaseKind === "TAWASI" ? (
              <Text style={styles.orderRowMeta}>
                سعر المبيع: {formatMoney(item.sellPrice)}
              </Text>
            ) : null}
          </View>
        )
      }
      ListHeaderComponent={
        <View style={styles.section}>
          <View style={styles.sectionHeaderInline}>
            <Text style={styles.sectionTitle}>استلام التوريدات</Text>
            <View style={styles.supplyHeaderActions}>
              <Pressable
                style={styles.smallRefreshButton}
                onPress={() =>
                  void refreshActiveScreenData({
                    force: true,
                    showIndicator: false,
                  })
                }
              >
                <Text style={styles.smallRefreshText}>تحديث</Text>
              </Pressable>
              <Pressable
                style={styles.smallRefreshButton}
                onPress={openTodayPurchasesInvoice}
              >
                <Text style={styles.smallRefreshText}>فاتورة اليوم</Text>
              </Pressable>
              <Pressable
                style={styles.addProductButton}
                onPress={() => {
                  if (!canManageInventory) {
                    setStatusMessage("وضع القراءة فقط: إدارة المنتجات غير متاحة.");
                  } else if (isProductFormOpen) {
                    resetProductForm();
                  } else {
                    openProductCreateForm();
                  }
                }}
              >
                <Text style={styles.addProductButtonText}>
                  {isProductFormOpen ? "إخفاء المنتج" : "منتج جديد"}
                </Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            style={styles.addExpenseFromPurchasesButton}
            onPress={() => setActiveScreen("expenses")}
          >
            <Text style={styles.addExpenseFromPurchasesButtonText}>تسجيل مصروف</Text>
          </Pressable>

          <View style={styles.supplyAddBox}>
            <Text style={styles.supplyAddTitle}>فاتورة المشتريات</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={purchaseInvoiceDateInput}
                onChangeText={setPurchaseInvoiceDateInput}
                placeholder="تاريخ الفاتورة YYYY-MM-DD"
                placeholderTextColor="#d7b3c4"
              />
              <Pressable
                style={styles.supplyActionButtonPrimary}
                onPress={() => openSelectedPurchasesInvoice()}
              >
                <Text style={styles.supplyActionButtonTextPrimary}>عرض الفاتورة</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.supplyAddBox}>
            <Text style={styles.supplyAddTitle}>تواصي</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={tawasiCapitalInput}
                onChangeText={setTawasiCapitalInput}
                keyboardType="decimal-pad"
                placeholder="رأس مال التواصي"
                placeholderTextColor="#d7b3c4"
              />
              <TextInput
                style={styles.input}
                value={tawasiSellPriceInput}
                onChangeText={setTawasiSellPriceInput}
                keyboardType="decimal-pad"
                placeholder="سعر المبيع"
                placeholderTextColor="#d7b3c4"
              />
            </View>
            <TextInput
              style={styles.inputFull}
              value={tawasiNoteInput}
              onChangeText={setTawasiNoteInput}
              placeholder="ملاحظة التواصي"
              placeholderTextColor="#d7b3c4"
            />
            <Pressable
              style={[
                styles.supplyActionButtonPrimary,
                (!canManageInventory || isSavingTawasi) && styles.buttonDisabled,
              ]}
              disabled={!canManageInventory || isSavingTawasi}
              onPress={() => void registerTawasiSupply()}
            >
              <Text style={styles.supplyActionButtonTextPrimary}>
                {isSavingTawasi ? "جار الحفظ..." : "تسجيل تواصي"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.supplyAddBox}>
            <Text style={styles.supplyAddTitle}>دفعة من فاتورة التوريدات</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={supplyPaymentAmountInput}
                onChangeText={setSupplyPaymentAmountInput}
                keyboardType="decimal-pad"
                placeholder="قيمة الدفعة"
                placeholderTextColor="#d7b3c4"
              />
              <TextInput
                style={styles.input}
                value={supplyPaymentNoteInput}
                onChangeText={setSupplyPaymentNoteInput}
                placeholder="بيان اختياري"
                placeholderTextColor="#d7b3c4"
              />
            </View>
            <Pressable
              style={[
                styles.supplyActionButtonPrimary,
                (!canManageInventory || isSavingSupplyPayment) &&
                  styles.buttonDisabled,
              ]}
              disabled={!canManageInventory || isSavingSupplyPayment}
              onPress={() => void registerSupplyPayment()}
            >
              <Text style={styles.supplyActionButtonTextPrimary}>
                {isSavingSupplyPayment ? "جار الحفظ..." : "تسجيل الدفعة"}
              </Text>
            </Pressable>
          </View>

          {isProductFormOpen ? (
            <View style={styles.supplyAddBox}>
              <Text style={styles.supplyAddTitle}>
                {productEditingId ? "تعديل منتج" : "إضافة منتج جديد"}
              </Text>
              <TextInput
                style={styles.inputFull}
                value={newProductNameInput}
                onChangeText={setNewProductNameInput}
                placeholder="اسم المنتج"
                placeholderTextColor="#d7b3c4"
              />
              <View style={styles.categoryRow}>
                {["PIECE", "KG"].map((unit) => (
                  <Pressable
                    key={unit}
                    style={[
                      styles.storeChip,
                      newProductUnitType === unit && styles.storeChipSelected,
                    ]}
                    onPress={() => setNewProductUnitType(unit)}
                  >
                    <Text
                      style={[
                        styles.storeChipText,
                        newProductUnitType === unit && styles.storeChipTextSelected,
                      ]}
                    >
                      {unit === "PIECE" ? "يباع بالقطعة" : "يباع بالكيلو"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={newProductSellPriceInput}
                  onChangeText={setNewProductSellPriceInput}
                  keyboardType="decimal-pad"
                  placeholder="سعر المبيع"
                  placeholderTextColor="#d7b3c4"
                />
                <TextInput
                  style={styles.input}
                  value={newProductCostPriceInput}
                  onChangeText={setNewProductCostPriceInput}
                  keyboardType="decimal-pad"
                  placeholder="سعر رأس المال"
                  placeholderTextColor="#d7b3c4"
                />
              </View>
              <View style={styles.supplyActionRow}>
                <Pressable style={styles.supplyActionButtonPrimary} onPress={saveProductDefinition}>
                  <Text style={styles.supplyActionButtonTextPrimary}>حفظ المنتج</Text>
                </Pressable>
                <Pressable style={styles.supplyActionButton} onPress={resetProductForm}>
                  <Text style={styles.supplyActionButtonText}>إلغاء</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      }
      />
      {purchaseDatePickerTarget && Platform.OS === "android" ? (
        <DateTimePicker
          mode="date"
          value={purchaseDatePickerValue}
          onChange={onPurchaseDatePickerChange}
          maximumDate={new Date("2100-12-31T00:00:00")}
          minimumDate={new Date("2000-01-01T00:00:00")}
        />
      ) : null}
      <Modal
        visible={purchaseDatePickerTarget !== null && Platform.OS !== "android"}
        transparent
        animationType="fade"
        onRequestClose={closePurchaseDatePicker}
      >
        <View style={styles.invoiceOverlay}>
          <View style={styles.datePickerModalCard}>
            <Text style={styles.sectionTitle}>
              {purchaseDatePickerTarget === "from"
                ? "اختر تاريخ البداية"
                : "اختر تاريخ النهاية"}
            </Text>
            {purchaseDatePickerTarget ? (
              <DateTimePicker
                mode="date"
                display="spinner"
                value={purchaseDatePickerValue}
                onChange={onPurchaseDatePickerChange}
                maximumDate={new Date("2100-12-31T00:00:00")}
                minimumDate={new Date("2000-01-01T00:00:00")}
              />
            ) : null}
            <View style={styles.rowActionButtons}>
              <Pressable
                style={styles.smallRefreshButton}
                onPress={closePurchaseDatePicker}
              >
                <Text style={styles.smallRefreshText}>إلغاء</Text>
              </Pressable>
              <Pressable
                style={styles.datePickerConfirmButton}
                onPress={confirmPurchaseDatePicker}
              >
                <Text style={styles.datePickerConfirmText}>اعتماد التاريخ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
