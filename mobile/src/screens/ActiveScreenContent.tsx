// @ts-nocheck
import { useAppScreenContext } from "./AppScreenContext";
import { AdminDashboardScreen } from "./AdminDashboardScreen";
import { EmployeesScreen } from "./EmployeesScreen";
import { ExpensesScreen } from "./ExpensesScreen";
import { OrdersScreen } from "./OrdersScreen";
import { PosScreen } from "./PosScreen";
import { PurchasesScreen } from "./PurchasesScreen";
import { SettlementScreen } from "./SettlementScreen";

export function ActiveScreenContent() {
  const { activeScreen } = useAppScreenContext();

  return (
    <>
      {activeScreen === "pos" && <PosScreen />}
      {activeScreen === "purchases" && <PurchasesScreen />}
      {activeScreen === "expenses" && <ExpensesScreen />}
      {activeScreen === "employees" && <EmployeesScreen />}
      {activeScreen === "orders" && <OrdersScreen />}
      {activeScreen === "settlement" && <SettlementScreen />}
      {activeScreen === "admin" && <AdminDashboardScreen />}
    </>
  );
}
