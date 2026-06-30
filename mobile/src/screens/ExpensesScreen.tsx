// @ts-nocheck
import { FlatList } from "react-native";

import { useAppScreenContext } from "./AppScreenContext";

export function ExpensesScreen() {
  const {
    Image,
    Pressable,
    Text,
    TextInput,
    View,
    addExpenseCategoryOption,
    beginExpenseEdit,
    buttonDisabled,
    canManageExpenses,
    clearExpenseImage,
    dangerButton,
    dangerButtonText,
    deleteExpenseRecord,
    effectiveExpenseCategoryOptions,
    expenseAmountInput,
    expenseCategoryInput,
    expenseDateInput,
    expenseDescriptionInput,
    expenseEditingId,
    expenseFilterCategory,
    expenseFilterFrom,
    expenseFilterText,
    expenseFilterTo,
    expenseImageLocalUri,
    expenseNoteInput,
    exportExpensesData,
    filteredExpenseRows,
    formatMoney,
    isAdmin,
    isPickingExpenseImage,
    isRefreshingActiveScreen,
    newExpenseCategoryLabelInput,
    openExpenseDetails,
    pickExpenseImage,
    refreshActiveScreenData,
    resetExpenseForm,
    saveExpense,
    setExpenseAmountInput,
    setExpenseCategoryInput,
    setExpenseDateInput,
    setExpenseDescriptionInput,
    setExpenseFilterCategory,
    setExpenseFilterFrom,
    setExpenseFilterText,
    setExpenseFilterTo,
    setExpenseNoteInput,
    setNewExpenseCategoryLabelInput,
    styles,
    toExpenseCategoryLabel,
  } = useAppScreenContext() as any;

  const renderCategory = (option, selected, onPress) => (
    <Pressable
      key={option.value}
      style={[styles.storeChip, selected && styles.storeChipSelected]}
      onPress={onPress}
    >
      <Text
        style={[styles.storeChipText, selected && styles.storeChipTextSelected]}
      >
        {option.label}
      </Text>
    </Pressable>
  );

  return (
    <FlatList
      style={styles.flexOne}
      contentContainerStyle={styles.content}
      data={filteredExpenseRows}
      keyExtractor={(item) => item.clientExpenseId}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      removeClippedSubviews
      updateCellsBatchingPeriod={50}
      windowSize={7}
      refreshing={isRefreshingActiveScreen}
      onRefresh={() =>
        void refreshActiveScreenData({ force: true, showIndicator: true })
      }
      renderItem={({ item }) => (
        <Pressable style={styles.orderRow} onPress={() => openExpenseDetails(item)}>
          <View style={styles.orderRowMain}>
            <Text style={styles.orderRowId}>{item.description}</Text>
            <Text style={styles.orderRowItems}>
              {toExpenseCategoryLabel(item.category)}
            </Text>
          </View>
          <View style={styles.orderRowMain}>
            <Text style={styles.orderRowTotal}>{formatMoney(item.amount)}</Text>
            <Text style={item.synced ? styles.syncedText : styles.pendingText}>
              {item.synced ? "متزامن" : "معلق"}
            </Text>
          </View>
          <Text style={styles.orderRowMeta}>{item.expenseDate}</Text>
          {item.imageUrl || item.localImageUri ? (
            <Text style={styles.orderRowHint}>اضغط لعرض صورة المصروف</Text>
          ) : null}
          {canManageExpenses ? (
            <View style={styles.rowActionButtons}>
              <Pressable
                style={styles.smallRefreshButton}
                onPress={(event) => {
                  event.stopPropagation();
                  beginExpenseEdit(item);
                }}
              >
                <Text style={styles.smallRefreshText}>تعديل</Text>
              </Pressable>
              <Pressable
                style={styles.dangerButton}
                onPress={(event) => {
                  event.stopPropagation();
                  void deleteExpenseRecord(item.clientExpenseId);
                }}
              >
                <Text style={styles.dangerButtonText}>حذف</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      )}
      ListHeaderComponent={
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeaderInline}>
              <Text style={styles.sectionTitle}>تسجيل المصاريف</Text>
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
            </View>

            {!canManageExpenses ? (
              <Text style={styles.emptyText}>
                وضع القراءة فقط: إضافة وتعديل وحذف المصاريف متاحان للكاشير أو الإدارة.
              </Text>
            ) : null}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={expenseDateInput}
                onChangeText={setExpenseDateInput}
                placeholder="التاريخ YYYY-MM-DD"
                placeholderTextColor="#d7b3c4"
              />
              <TextInput
                style={styles.input}
                value={expenseAmountInput}
                onChangeText={setExpenseAmountInput}
                keyboardType="decimal-pad"
                placeholder="المبلغ"
                placeholderTextColor="#d7b3c4"
              />
            </View>

            <View style={styles.categoryRow}>
              {effectiveExpenseCategoryOptions.map((option) =>
                renderCategory(
                  option,
                  expenseCategoryInput === option.value,
                  () => setExpenseCategoryInput(option.value),
                ),
              )}
            </View>

            {isAdmin ? (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={newExpenseCategoryLabelInput}
                  onChangeText={setNewExpenseCategoryLabelInput}
                  placeholder="نوع مصروف جديد"
                  placeholderTextColor="#d7b3c4"
                />
                <Pressable
                  style={styles.smallRefreshButton}
                  onPress={addExpenseCategoryOption}
                >
                  <Text style={styles.smallRefreshText}>إضافة النوع</Text>
                </Pressable>
              </View>
            ) : null}

            <TextInput
              style={styles.inputFull}
              value={expenseDescriptionInput}
              onChangeText={setExpenseDescriptionInput}
              placeholder="وصف المصروف"
              placeholderTextColor="#d7b3c4"
            />
            <TextInput
              style={styles.inputFull}
              value={expenseNoteInput}
              onChangeText={setExpenseNoteInput}
              placeholder="ملاحظة اختيارية"
              placeholderTextColor="#d7b3c4"
            />

            <View style={styles.rowActionButtons}>
              <Pressable
                style={[
                  styles.smallRefreshButton,
                  isPickingExpenseImage && styles.buttonDisabled,
                ]}
                disabled={isPickingExpenseImage}
                onPress={() => void pickExpenseImage()}
              >
                <Text style={styles.smallRefreshText}>
                  {isPickingExpenseImage ? "جار فتح الصور..." : "إضافة صورة"}
                </Text>
              </Pressable>
              {expenseImageLocalUri ? (
                <Pressable style={styles.dangerButton} onPress={clearExpenseImage}>
                  <Text style={styles.dangerButtonText}>حذف الصورة</Text>
                </Pressable>
              ) : null}
            </View>
            {expenseImageLocalUri ? (
              <View style={styles.expenseImagePreviewBox}>
                <Image
                  source={{ uri: expenseImageLocalUri }}
                  style={styles.expenseImagePreview}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            <View style={styles.sectionActions}>
              <Pressable
                style={[
                  styles.primaryButton,
                  !canManageExpenses && styles.buttonDisabled,
                ]}
                disabled={!canManageExpenses}
                onPress={() => void saveExpense()}
              >
                <Text style={styles.primaryButtonText}>
                  {expenseEditingId ? "تحديث المصروف" : "إضافة مصروف"}
                </Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={resetExpenseForm}>
                <Text style={styles.secondaryButtonText}>إلغاء التعديل</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderInline}>
              <Text style={styles.sectionTitle}>سجل المصاريف</Text>
              <Pressable style={styles.smallRefreshButton} onPress={() => void exportExpensesData()}>
                <Text style={styles.smallRefreshText}>تصدير CSV</Text>
              </Pressable>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={expenseFilterFrom}
                onChangeText={setExpenseFilterFrom}
                placeholder="من تاريخ"
                placeholderTextColor="#d7b3c4"
              />
              <TextInput
                style={styles.input}
                value={expenseFilterTo}
                onChangeText={setExpenseFilterTo}
                placeholder="إلى تاريخ"
                placeholderTextColor="#d7b3c4"
              />
            </View>
            <TextInput
              style={styles.inputFull}
              value={expenseFilterText}
              onChangeText={setExpenseFilterText}
              placeholder="فلترة حسب الوصف"
              placeholderTextColor="#d7b3c4"
            />
            <View style={styles.categoryRow}>
              <Pressable
                style={[
                  styles.storeChip,
                  expenseFilterCategory === "ALL" && styles.storeChipSelected,
                ]}
                onPress={() => setExpenseFilterCategory("ALL")}
              >
                <Text
                  style={[
                    styles.storeChipText,
                    expenseFilterCategory === "ALL" && styles.storeChipTextSelected,
                  ]}
                >
                  الكل
                </Text>
              </Pressable>
              {effectiveExpenseCategoryOptions.map((option) =>
                renderCategory(
                  option,
                  expenseFilterCategory === option.value,
                  () => setExpenseFilterCategory(option.value),
                ),
              )}
            </View>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.section}>
          <Text style={styles.emptyText}>لا يوجد قيود مصاريف.</Text>
        </View>
      }
    />
  );
}
