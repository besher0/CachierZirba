// @ts-nocheck
import { SectionList } from "react-native";

import { useAppScreenContext } from "./AppScreenContext";

export function SettlementScreen() {
  const {
    Pressable,
    Text,
    TextInput,
    View,
    actualRemainingInput,
    adminProductSalesFromInput,
    adminProductSalesToInput,
    auditNetSalesAmount,
    cashBoxInput,
    canManageInventory,
    clearAdminProductSalesDateFilters,
    commitInventoryAdjustment,
    formatMoney,
    formatQuantity,
    inventoryDestructionNoteInput,
    inventoryDestructionQuantityInput,
    isAdmin,
    isRefreshingActiveScreen,
    openSettlementDetails,
    pieceStockAuditRows,
    productSupplyRows,
    recordInventoryDestruction,
    refreshAdminProductSalesData,
    refreshActiveScreenData,
    selectedAdminProductSalesProduct,
    selectedAdminProductSalesProductId,
    selectedAdminProductSalesRow,
    selectedStore,
    selectedInventoryDestructionProductId,
    settlementActualInputs,
    settlementArchiveRows,
    settlementCarryForwardAmount,
    settlementCycleStartIso,
    settlementDifferenceAmount,
    settlementExpectedRevenueAmount,
    settlementInventoryDestructionRows,
    settlementNetSalesWithAudit,
    settlementNoteInput,
    settlementOverDistributedAmount,
    settlementProductSalesSummaryRows,
    settlementRefundTotalWithAudit,
    settlementSalesTotalWithAudit,
    sharesInput,
    setActualRemainingInput,
    setSelectedAdminProductSalesProductId,
    setSettlementNoteInput,
    styles,
    submitDailySettlement,
    toShortDate,
    todayEmployeeWithdrawalsTotal,
    todayExpensesTotal,
    todayPurchasesTotal,
    todaySupplyPurchasesTotal,
    todayTawasiTotal,
    updateCashBoxInput,
    setInventoryDestructionNoteInput,
    setSelectedInventoryDestructionProductId,
    updateInventoryDestructionQuantityInput,
    updateSettlementActualInput,
    updateSharesInput,
    openAdminProductSalesDatePicker,
  } = useAppScreenContext() as any;

  const sections = [
    { key: "sales", data: settlementProductSalesSummaryRows },
    { key: "adminProductSales", data: isAdmin ? [{ id: "admin-product-sales" }] : [] },
    { key: "destructionInput", data: canManageInventory ? [{ id: "destruction-form" }] : [] },
    { key: "destructionHistory", data: settlementInventoryDestructionRows },
    { key: "audit", data: pieceStockAuditRows },
    { key: "archive", data: settlementArchiveRows },
  ];

  const sectionTitle = (section) => {
    switch (section.key) {
      case "sales":
        return "ملخص بيع المنتجات";
      case "adminProductSales":
        return "جرد مبيعات منتج";
      case "destructionInput":
        return "إتلاف من المخزون";
      case "destructionHistory":
        return "المنتجات المتلفة في الدورة";
      case "audit":
        return "تدقيق مخزون منتجات القطعة";
      case "archive":
        return `أرشيف تسويات ${selectedStore?.name ?? "الفرع"}`;
      default:
        return "";
    }
  };

  const selectedDestructionProduct = productSupplyRows.find(
    (item) => item.productId === selectedInventoryDestructionProductId,
  );

  return (
    <SectionList
      style={styles.flexOne}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item, index) =>
        item.productId ?? item.id ?? item.clientClosureId ?? `${index}`
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
      ListHeaderComponent={
        <View style={styles.section}>
          <View style={styles.sectionHeaderInline}>
            <Text style={styles.sectionTitle}>تسوية اليوم</Text>
            <Pressable
              style={styles.smallRefreshButton}
              onPress={() =>
                void refreshActiveScreenData({
                  force: true,
                  showIndicator: false,
                })
              }
            >
              <Text style={styles.smallRefreshText}>تحديث الكل</Text>
            </Pressable>
          </View>
          <View style={styles.settlementStatsGrid}>
            {[
              ["مبيعات الدورة", settlementSalesTotalWithAudit, false],
              ["مرتجعات الدورة", settlementRefundTotalWithAudit, false],
              ["صافي الدورة", settlementNetSalesWithAudit, false],
              ["توريدات الدورة", todayPurchasesTotal, false],
              ["مصاريف الدورة", todayExpensesTotal, false],
              ["سحوبات الموظفين", todayEmployeeWithdrawalsTotal, false],
              ["المبلغ المفروض متبقي", settlementExpectedRevenueAmount, true],
            ].map(([label, value, highlighted]) => (
              <View
                key={label}
                style={
                  highlighted
                    ? styles.settlementStatCardHighlight
                    : styles.settlementStatCard
                }
              >
                <Text
                  style={
                    highlighted
                      ? styles.settlementStatLabelHighlight
                      : styles.settlementStatLabel
                  }
                >
                  {label}
                </Text>
                <Text
                  style={
                    highlighted
                      ? styles.settlementStatValueHighlight
                      : styles.settlementStatValue
                  }
                >
                  {formatMoney(value)}
                </Text>
              </View>
            ))}
            <View style={styles.settlementStatCard}>
              <Text style={styles.settlementStatLabel}>مبلغ التواصي للدورة</Text>
              <Text style={styles.settlementStatValue}>
                {formatMoney(todayTawasiTotal ?? 0)}
              </Text>
            </View>
          </View>
          {settlementCycleStartIso ? (
            <Text style={styles.orderRowMeta}>
              الدورة الحالية من بعد آخر تسوية: {toShortDate(settlementCycleStartIso)}
            </Text>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={cashBoxInput}
              onChangeText={updateCashBoxInput}
              keyboardType="decimal-pad"
              placeholder="قيمة الصندوق"
              placeholderTextColor="#d7b3c4"
            />
            <TextInput
              style={styles.input}
              value={sharesInput}
              onChangeText={updateSharesInput}
              keyboardType="decimal-pad"
              placeholder="قيمة الحصص"
              placeholderTextColor="#d7b3c4"
            />
          </View>
          <TextInput
            style={styles.inputFull}
            value={actualRemainingInput}
            onChangeText={setActualRemainingInput}
            keyboardType="decimal-pad"
            placeholder="المبلغ الفعلي المتبقي مع الكاشير"
            placeholderTextColor="#d7b3c4"
          />
          <Text style={styles.orderRowMeta}>
            صافي فرق جرد القطع: {formatMoney(auditNetSalesAmount)}
          </Text>
          <Text style={styles.orderRowMeta}>
            المتبقي الذي سيرحل: {formatMoney(settlementCarryForwardAmount)}
          </Text>
          <Text
            style={
              settlementDifferenceAmount === 0
                ? styles.settlementDiffNeutral
                : settlementDifferenceAmount > 0
                  ? styles.settlementDiffPositive
                  : styles.settlementDiffNegative
            }
          >
            فرق التسوية: {formatMoney(settlementDifferenceAmount)}
          </Text>
          {settlementOverDistributedAmount > 0 ? (
            <Text style={styles.pendingText}>
              تنبيه: المدخلات أعلى من المبلغ الفعلي بمقدار {formatMoney(settlementOverDistributedAmount)}.
            </Text>
          ) : null}
          <TextInput
            style={styles.inputFull}
            value={settlementNoteInput}
            onChangeText={setSettlementNoteInput}
            placeholder="ملاحظة اليوم اختيارية"
            placeholderTextColor="#d7b3c4"
          />
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void submitDailySettlement()}
          >
            <Text style={styles.secondaryButtonText}>إغلاق اليوم وحفظ التسوية</Text>
          </Pressable>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeaderInline}>
          <Text style={styles.sectionTitle}>{sectionTitle(section)}</Text>
          {section.key === "archive" ? (
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
          ) : null}
          {section.data.length === 0 ? (
            <Text style={styles.emptyText}>لا توجد بيانات مسجلة.</Text>
          ) : null}
        </View>
      )}
      renderItem={({ item, section }) => {
        if (section.key === "sales") {
          return (
            <View style={styles.orderRow}>
              <View style={styles.orderRowMain}>
                <Text style={styles.orderRowId}>{item.name}</Text>
                <Text style={styles.orderRowItems}>
                  {item.unitType === "KG" ? "كيلو" : "قطعة"}
                </Text>
              </View>
              <View style={styles.orderRowMain}>
                <Text style={styles.orderRowMeta}>مباع: {item.soldQty}</Text>
                <Text style={styles.orderRowMeta}>مرتجع: {item.refundedQty}</Text>
              </View>
              <Text style={styles.orderRowTotal}>{formatMoney(item.netAmount)}</Text>
            </View>
          );
        }

        if (section.key === "adminProductSales") {
          const reportRow = selectedAdminProductSalesRow ?? {
            soldQty: 0,
            refundedQty: 0,
            netQty: 0,
            netAmount: 0,
          };

          return (
            <View style={styles.orderRow}>
              <Text style={styles.orderRowMeta}>
                اختر المنتج والفترة لعرض كمية المبيع والمرتجع لهذا الفرع.
              </Text>
              <View style={styles.rowActionButtons}>
                {productSupplyRows.map((product) => {
                  const selected =
                    product.productId === selectedAdminProductSalesProductId;
                  return (
                    <Pressable
                      key={product.productId}
                      style={[
                        styles.smallRefreshButton,
                        selected && styles.addProductButton,
                      ]}
                      onPress={() =>
                        setSelectedAdminProductSalesProductId(product.productId)
                      }
                    >
                      <Text
                        style={
                          selected
                            ? styles.addProductButtonText
                            : styles.smallRefreshText
                        }
                      >
                        {product.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.inputRow}>
                <Pressable
                  style={styles.input}
                  onPress={() => openAdminProductSalesDatePicker("from")}
                >
                  <Text
                    style={
                      adminProductSalesFromInput
                        ? styles.datePickerInputText
                        : styles.datePickerInputPlaceholder
                    }
                  >
                    {adminProductSalesFromInput || "اختر من تاريخ"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.input}
                  onPress={() => openAdminProductSalesDatePicker("to")}
                >
                  <Text
                    style={
                      adminProductSalesToInput
                        ? styles.datePickerInputText
                        : styles.datePickerInputPlaceholder
                    }
                  >
                    {adminProductSalesToInput || "اختر إلى تاريخ"}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.rowActionButtons}>
                <Pressable
                  style={styles.smallRefreshButton}
                  onPress={clearAdminProductSalesDateFilters}
                >
                  <Text style={styles.smallRefreshText}>مسح التاريخ</Text>
                </Pressable>
                <Pressable
                  style={styles.smallRefreshButton}
                  onPress={() => void refreshAdminProductSalesData()}
                >
                  <Text style={styles.smallRefreshText}>تحديث الجرد</Text>
                </Pressable>
              </View>
              <View style={styles.orderRowMain}>
                <Text style={styles.orderRowId}>
                  {selectedAdminProductSalesProduct?.name ?? "اختر منتجاً"}
                </Text>
                <Text style={styles.orderRowItems}>
                  {selectedAdminProductSalesProduct?.unitType === "KG"
                    ? "كيلو"
                    : "قطعة"}
                </Text>
              </View>
              <View style={styles.orderRowMain}>
                <Text style={styles.orderRowMeta}>
                  مباع: {formatQuantity(reportRow.soldQty)}
                </Text>
                <Text style={styles.orderRowMeta}>
                  مرتجع: {formatQuantity(reportRow.refundedQty)}
                </Text>
              </View>
              <View style={styles.orderRowMain}>
                <Text style={styles.orderRowMeta}>
                  صافي الكمية: {formatQuantity(reportRow.netQty)}
                </Text>
                <Text style={styles.orderRowTotal}>
                  {formatMoney(reportRow.netAmount)}
                </Text>
              </View>
            </View>
          );
        }

        if (section.key === "destructionInput") {
          return (
            <View style={styles.orderRow}>
              <Text style={styles.orderRowId}>اختر المنتج</Text>
              <View style={styles.rowActionButtons}>
                {productSupplyRows.map((product) => {
                  const selected =
                    product.productId === selectedInventoryDestructionProductId;
                  return (
                    <Pressable
                      key={product.productId}
                      style={[
                        styles.smallRefreshButton,
                        selected && styles.addProductButton,
                      ]}
                      onPress={() =>
                        setSelectedInventoryDestructionProductId(product.productId)
                      }
                    >
                      <Text
                        style={
                          selected
                            ? styles.addProductButtonText
                            : styles.smallRefreshText
                        }
                      >
                        {product.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedDestructionProduct ? (
                <Text style={styles.orderRowMeta}>
                  المتاح: {formatQuantity(selectedDestructionProduct.remainingQty)} {selectedDestructionProduct.unitType === "KG" ? "كيلو" : "قطعة"}
                </Text>
              ) : (
                <Text style={styles.orderRowMeta}>اختر منتجًا لإدخال كمية الإتلاف.</Text>
              )}
              <TextInput
                style={styles.inputFull}
                value={inventoryDestructionQuantityInput}
                onChangeText={updateInventoryDestructionQuantityInput}
                keyboardType="decimal-pad"
                placeholder="كمية الإتلاف"
                placeholderTextColor="#d7b3c4"
              />
              <TextInput
                style={styles.inputFull}
                value={inventoryDestructionNoteInput}
                onChangeText={setInventoryDestructionNoteInput}
                placeholder="سبب الإتلاف اختياري"
                placeholderTextColor="#d7b3c4"
              />
              <Pressable
                style={[
                  styles.secondaryButton,
                  !selectedInventoryDestructionProductId && styles.buttonDisabled,
                ]}
                disabled={!selectedInventoryDestructionProductId}
                onPress={() => void recordInventoryDestruction()}
              >
                <Text style={styles.secondaryButtonText}>إتلاف الكمية</Text>
              </Pressable>
            </View>
          );
        }

        if (false && section.key === "destructionInput") {
          return (
            <View style={styles.orderRow}>
              <Text style={styles.orderRowId}>{item.name}</Text>
              <Text style={styles.orderRowMeta}>
                المتاح: {formatQuantity(item.remainingQty)} {item.unitType === "KG" ? "كيلو" : "قطعة"}
              </Text>
              <TextInput
                style={styles.inputFull}
                value={inventoryDestructionInputs[item.productId] ?? ""}
                onChangeText={(value) => updateInventoryDestructionInput(item.productId, value)}
                keyboardType="decimal-pad"
                placeholder="كمية الإتلاف"
                placeholderTextColor="#d7b3c4"
              />
              <TextInput
                style={styles.inputFull}
                value={inventoryDestructionNoteInputs[item.productId] ?? ""}
                onChangeText={(value) =>
                  updateInventoryDestructionNoteInput(item.productId, value)
                }
                placeholder="سبب الإتلاف اختياري"
                placeholderTextColor="#d7b3c4"
              />
              <Pressable
                style={styles.secondaryButton}
                onPress={() => void recordInventoryDestruction(item.productId)}
              >
                <Text style={styles.secondaryButtonText}>إتلاف الكمية</Text>
              </Pressable>
            </View>
          );
        }

        if (section.key === "destructionHistory") {
          return (
            <View style={styles.orderRow}>
              <Text style={styles.orderRowId}>{item.productName}</Text>
              <Text style={styles.orderRowMeta}>
                كمية متلفة: {formatQuantity(item.quantity)}
              </Text>
              <Text style={styles.orderRowMeta}>{toShortDate(item.destroyedAt)}</Text>
              {item.note ? <Text style={styles.orderRowMeta}>{item.note}</Text> : null}
            </View>
          );
        }

        if (section.key === "audit") {
          return (
            <View style={styles.orderRow}>
              <View style={styles.orderRowMain}>
                <Text style={styles.orderRowId}>{item.productName}</Text>
                <Text style={styles.orderRowItems}>النظري: {item.expectedQty}</Text>
              </View>
              <View style={styles.orderRowMain}>
                <Text style={styles.orderRowMeta}>
                  زائد من قبل: {formatQuantity(item.previousRemainingQty)}
                </Text>
                <Text style={styles.orderRowMeta}>
                  نزل اليوم: {formatQuantity(item.receivedTodayQty)}
                </Text>
              </View>
              <TextInput
                style={styles.inputFull}
                value={settlementActualInputs[item.productId] ?? ""}
                onChangeText={(value) => updateSettlementActualInput(item.productId, value)}
                onBlur={() => {
                  if (isAdmin) {
                    void commitInventoryAdjustment(item.productId);
                  }
                }}
                keyboardType="decimal-pad"
                placeholder="العدد الفعلي"
                placeholderTextColor="#d7b3c4"
              />
              {item.diffQty !== null ? (
                <Text
                  style={
                    item.diffQty === 0
                      ? styles.settlementDiffNeutral
                      : item.diffQty > 0
                        ? styles.settlementDiffPositive
                        : styles.settlementDiffNegative
                  }
                >
                  الفرق: {item.diffQty}
                </Text>
              ) : null}
              {!isAdmin && item.adjustmentAmount !== null ? (
                <Text style={styles.orderRowMeta}>
                  قيمة الفرق: {formatMoney(item.adjustmentAmount)}
                </Text>
              ) : null}
            </View>
          );
        }

        return (
          <Pressable style={styles.settlementRow} onPress={() => openSettlementDetails(item)}>
            <View style={styles.orderRowMain}>
              <Text style={styles.orderRowId}>{item.businessDate}</Text>
              <Text style={item.synced ? styles.syncedText : styles.pendingText}>
                {item.synced ? "متزامن" : "معلق"}
              </Text>
            </View>
            <View style={styles.orderRowMain}>
              <Text style={styles.orderRowMeta}>مبيعات: {formatMoney(item.salesAmount)}</Text>
              <Text style={styles.orderRowMeta}>مرتجعات: {formatMoney(item.refundAmount)}</Text>
            </View>
            <View style={styles.orderRowMain}>
              <Text style={styles.orderRowMeta}>فواتير: {item.ordersCount}</Text>
              <Text style={styles.orderRowMeta}>مصاريف: {formatMoney(item.expensesAmount)}</Text>
            </View>
            <Text style={styles.orderRowHint}>اضغط لعرض تفاصيل التسوية</Text>
          </Pressable>
        );
      }}
    />
  );
}
