// @ts-nocheck
import { useAppScreenContext } from "./AppScreenContext";

export function PurchasesScreen() {
  const {
    CSV,
    KG,
    PIECE,
    Pressable,
    Text,
    TextInput,
    View,
    addExpenseFromPurchasesButton,
    addExpenseFromPurchasesButtonText,
    addProductButton,
    addProductButtonText,
    addProductCtaButton,
    addProductCtaButtonText,
    addProductInlineButton,
    addProductInlineButtonText,
    beginProductEdit,
    buttonDisabled,
    canManageInventory,
    categoryRow,
    clientPurchaseId,
    costPrice,
    d7b3c4,
    dangerButton,
    dangerButtonText,
    decimal,
    deleteProductDefinition,
    deletePurchaseRecord,
    disabled,
    editable,
    emptyText,
    expenses,
    exportPurchasesData,
    filteredPurchaseRows,
    formatMoney,
    input,
    inputFull,
    inputRow,
    isProductFormOpen,
    item,
    key,
    keyboardType,
    length,
    loggedToday,
    map,
    name,
    newProductCostPriceInput,
    newProductNameInput,
    newProductSellPriceInput,
    newProductUnitType,
    note,
    onChangeText,
    onPress,
    openProductCreateForm,
    orderRow,
    orderRowId,
    orderRowItems,
    orderRowMain,
    orderRowMeta,
    orderRowTotal,
    pad,
    pendingText,
    placeholder,
    placeholderTextColor,
    primaryButton,
    primaryButtonText,
    productEditingId,
    productId,
    productName,
    productSupplyRows,
    purchaseDate,
    purchaseFilterFrom,
    purchaseFilterProduct,
    purchaseFilterTo,
    quantity,
    receiveTodaySupplies,
    refreshProductsData,
    refreshPurchasesData,
    registerTawasiSupply,
    remainingQty,
    resetProductForm,
    row,
    rowActionButtons,
    saveProductDefinition,
    section,
    sectionActions,
    sectionHeaderInline,
    sectionTitle,
    selectTextOnFocus,
    sellPrice,
    setActiveScreen,
    setNewProductCostPriceInput,
    setNewProductNameInput,
    setNewProductSellPriceInput,
    setNewProductUnitType,
    setPurchaseFilterFrom,
    setPurchaseFilterProduct,
    setPurchaseFilterTo,
    setStatusMessage,
    setTawasiCapitalInput,
    setTawasiSellPriceInput,
    smallRefreshButton,
    smallRefreshText,
    storeChip,
    storeChipSelected,
    storeChipText,
    storeChipTextSelected,
    style,
    styles,
    supplyActionButton,
    supplyActionButtonPrimary,
    supplyActionButtonText,
    supplyActionButtonTextPrimary,
    supplyActionRow,
    supplyAddBox,
    supplyAddTitle,
    supplyColumnsHeader,
    supplyColumnsHeaderText,
    supplyEmptyState,
    supplyField,
    supplyFieldLabel,
    supplyFieldsRow,
    supplyHeaderActions,
    supplyLoggedTodayText,
    supplyReadonlyInput,
    supplyRow,
    synced,
    syncedText,
    tawasiCapitalInput,
    tawasiSellPriceInput,
    todaySupplyInputs,
    totalCost,
    unitCost,
    unitType,
    updateTodaySupplyInput,
    value,
  } = useAppScreenContext() as any;

  return (
<>
                    <View style={styles.section}>
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>
                          استلام التوريدات
                        </Text>
                        <View style={styles.supplyHeaderActions}>
                          <Pressable
                            style={styles.smallRefreshButton}
                            onPress={() => void refreshPurchasesData()}
                          >
                            <Text style={styles.smallRefreshText}>تحديث</Text>
                          </Pressable>
                          <Pressable
                            style={styles.smallRefreshButton}
                            onPress={() => void refreshProductsData()}
                          >
                            <Text style={styles.smallRefreshText}>
                              تحديث الكتالوج
                            </Text>
                          </Pressable>
                          <Pressable
                            style={styles.addProductButton}
                            onPress={() => {
                              if (!canManageInventory) {
                                setStatusMessage(
                                  "وضع القراءة فقط: إضافة المنتجات متاحة للكاشير أو الأدمن فقط.",
                                );
                                return;
                              }
                              if (isProductFormOpen) {
                                resetProductForm();
                              } else {
                                openProductCreateForm();
                              }
                            }}
                          >
                            <Text style={styles.addProductButtonText}>
                              {isProductFormOpen
                                ? "إخفاء + منتج"
                                : "+ منتج جديد"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      {!canManageInventory && (
                        <Text style={styles.emptyText}>
                          وضع القراءة فقط: إضافة/تعديل/حذف متاح للكاشير أو
                          الأدمن فقط.
                        </Text>
                      )}

                      <Pressable
                        style={styles.addExpenseFromPurchasesButton}
                        onPress={() => setActiveScreen("expenses")}
                      >
                        <Text style={styles.addExpenseFromPurchasesButtonText}>
                          + تسجيل مصروف
                        </Text>
                      </Pressable>

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
                            placeholder="سعر مبيع التواصي"
                            placeholderTextColor="#d7b3c4"
                          />
                        </View>
                        <Pressable
                          style={[
                            styles.supplyActionButtonPrimary,
                            !canManageInventory && styles.buttonDisabled,
                          ]}
                          disabled={!canManageInventory}
                          onPress={() => void registerTawasiSupply()}
                        >
                          <Text style={styles.supplyActionButtonTextPrimary}>
                            تسجيل تواصي
                          </Text>
                        </Pressable>
                      </View>

                      {isProductFormOpen && (
                        <View style={styles.supplyAddBox}>
                          <Text style={styles.supplyAddTitle}>
                            {productEditingId
                              ? "تعديل منتج"
                              : "إضافة منتج جديد"}
                          </Text>
                          <TextInput
                            style={styles.inputFull}
                            value={newProductNameInput}
                            onChangeText={setNewProductNameInput}
                            placeholder="اسم المنتج"
                            placeholderTextColor="#d7b3c4"
                          />
                          <Text style={styles.supplyFieldLabel}>نوع البيع</Text>
                          <View style={styles.categoryRow}>
                            <Pressable
                              style={[
                                styles.storeChip,
                                newProductUnitType === "PIECE" &&
                                  styles.storeChipSelected,
                              ]}
                              onPress={() => setNewProductUnitType("PIECE")}
                            >
                              <Text
                                style={[
                                  styles.storeChipText,
                                  newProductUnitType === "PIECE" &&
                                    styles.storeChipTextSelected,
                                ]}
                              >
                                يباع بالقطعة
                              </Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.storeChip,
                                newProductUnitType === "KG" &&
                                  styles.storeChipSelected,
                              ]}
                              onPress={() => setNewProductUnitType("KG")}
                            >
                              <Text
                                style={[
                                  styles.storeChipText,
                                  newProductUnitType === "KG" &&
                                    styles.storeChipTextSelected,
                                ]}
                              >
                                يباع بالكيلو
                              </Text>
                            </Pressable>
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
                              placeholder="سعر الرأس مال"
                              placeholderTextColor="#d7b3c4"
                            />
                          </View>
                          <View style={styles.supplyActionRow}>
                            <Pressable
                              style={styles.supplyActionButtonPrimary}
                              onPress={saveProductDefinition}
                            >
                              <Text
                                style={styles.supplyActionButtonTextPrimary}
                              >
                                {productEditingId
                                  ? "تحديث المنتج"
                                  : "حفظ المنتج"}
                              </Text>
                            </Pressable>
                            <Pressable
                              style={styles.supplyActionButton}
                              onPress={resetProductForm}
                            >
                              <Text style={styles.supplyActionButtonText}>
                                {productEditingId ? "إلغاء التعديل" : "إلغاء"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      )}

                      <View style={styles.supplyColumnsHeader}>
                        <Text style={styles.supplyColumnsHeaderText}>
                          المنتج
                        </Text>
                        <Text style={styles.supplyColumnsHeaderText}>
                          العدد المتبقي
                        </Text>
                        <Text style={styles.supplyColumnsHeaderText}>
                          نزل اليوم
                        </Text>
                      </View>

                      {productSupplyRows.length === 0 ? (
                        <View style={styles.supplyEmptyState}>
                          <Text style={styles.emptyText}>
                            لا توجد منتجات بعد. اضغط + منتج جديد.
                          </Text>
                          <Pressable
                            style={[
                              styles.addProductCtaButton,
                              !canManageInventory && styles.buttonDisabled,
                            ]}
                            disabled={!canManageInventory}
                            onPress={openProductCreateForm}
                          >
                            <Text style={styles.addProductCtaButtonText}>
                              + إضافة أول منتج
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        productSupplyRows.map((row) => (
                          <View key={row.productId} style={styles.supplyRow}>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>{row.name}</Text>
                              <Text style={styles.orderRowMeta}>
                                {row.unitType === "KG"
                                  ? "يباع بالكيلو"
                                  : "يباع بالقطعة"}
                              </Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowMeta}>
                                مبيع: {formatMoney(row.sellPrice)}
                              </Text>
                              <Text style={styles.orderRowMeta}>
                                رأس المال: {formatMoney(row.costPrice)}
                              </Text>
                            </View>
                            <View style={styles.supplyFieldsRow}>
                              <View style={styles.supplyField}>
                                <Text style={styles.supplyFieldLabel}>
                                  العدد المتبقي
                                </Text>
                                <TextInput
                                  style={[
                                    styles.input,
                                    styles.supplyReadonlyInput,
                                  ]}
                                  value={`${row.remainingQty}`}
                                  editable={false}
                                  selectTextOnFocus={false}
                                />
                              </View>
                              <View style={styles.supplyField}>
                                <Text style={styles.supplyFieldLabel}>
                                  نزل اليوم
                                </Text>
                                <TextInput
                                  style={styles.input}
                                  value={todaySupplyInputs[row.productId] ?? ""}
                                  onChangeText={(value) =>
                                    updateTodaySupplyInput(row.productId, value)
                                  }
                                  keyboardType="decimal-pad"
                                  placeholder="أدخل الكمية الجديدة"
                                  placeholderTextColor="#d7b3c4"
                                />
                                <Text style={styles.supplyLoggedTodayText}>
                                  المسجل اليوم: {row.loggedToday}
                                </Text>
                              </View>
                            </View>
                            {canManageInventory && (
                              <View style={styles.rowActionButtons}>
                                <Pressable
                                  style={styles.smallRefreshButton}
                                  onPress={() =>
                                    beginProductEdit(row.productId)
                                  }
                                >
                                  <Text style={styles.smallRefreshText}>
                                    تعديل المنتج
                                  </Text>
                                </Pressable>
                                <Pressable
                                  style={styles.dangerButton}
                                  onPress={() =>
                                    deleteProductDefinition(row.productId)
                                  }
                                >
                                  <Text style={styles.dangerButtonText}>
                                    حذف المنتج
                                  </Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        ))
                      )}

                      {!isProductFormOpen && (
                        <Pressable
                          style={[
                            styles.addProductInlineButton,
                            !canManageInventory && styles.buttonDisabled,
                          ]}
                          disabled={!canManageInventory}
                          onPress={openProductCreateForm}
                        >
                          <Text style={styles.addProductInlineButtonText}>
                            + منتج جديد
                          </Text>
                        </Pressable>
                      )}

                      <View style={styles.sectionActions}>
                        <Pressable
                          style={[
                            styles.primaryButton,
                            !canManageInventory && styles.buttonDisabled,
                          ]}
                          disabled={!canManageInventory}
                          onPress={() => void receiveTodaySupplies()}
                        >
                          <Text style={styles.primaryButtonText}>
                            تثبيت توريدات اليوم
                          </Text>
                        </Pressable>
                      </View>
                    </View>

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
                        <TextInput
                          style={styles.input}
                          value={purchaseFilterFrom}
                          onChangeText={setPurchaseFilterFrom}
                          placeholder="من تاريخ"
                          placeholderTextColor="#d7b3c4"
                        />
                        <TextInput
                          style={styles.input}
                          value={purchaseFilterTo}
                          onChangeText={setPurchaseFilterTo}
                          placeholder="إلى تاريخ"
                          placeholderTextColor="#d7b3c4"
                        />
                      </View>
                      <TextInput
                        style={styles.inputFull}
                        value={purchaseFilterProduct}
                        onChangeText={setPurchaseFilterProduct}
                        placeholder="فلترة باسم المنتج"
                        placeholderTextColor="#d7b3c4"
                      />

                      {filteredPurchaseRows.length === 0 ? (
                        <Text style={styles.emptyText}>
                          لا يوجد قيود مشتريات.
                        </Text>
                      ) : (
                        filteredPurchaseRows.map((item) => (
                          <View
                            key={item.clientPurchaseId}
                            style={styles.orderRow}
                          >
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>
                                {item.productName}
                              </Text>
                              <Text style={styles.orderRowItems}>
                                {item.quantity} × {formatMoney(item.unitCost)}
                              </Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowTotal}>
                                {formatMoney(item.totalCost)}
                              </Text>
                              <Text
                                style={
                                  item.synced
                                    ? styles.syncedText
                                    : styles.pendingText
                                }
                              >
                                {item.synced ? "متزامن" : "معلق"}
                              </Text>
                            </View>
                            <Text style={styles.orderRowMeta}>
                              {item.purchaseDate}
                            </Text>
                            {item.note ? (
                              <Text style={styles.orderRowMeta}>
                                {item.note}
                              </Text>
                            ) : null}
                            {canManageInventory && (
                              <View style={styles.rowActionButtons}>
                                <Pressable
                                  style={styles.dangerButton}
                                  onPress={() =>
                                    void deletePurchaseRecord(
                                      item.clientPurchaseId,
                                    )
                                  }
                                >
                                  <Text style={styles.dangerButtonText}>
                                    حذف
                                  </Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        ))
                      )}
                    </View>
                  </>
  );
}
