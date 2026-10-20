"use client";

import { formatPrice, getWilaya, type DashboardStats } from "@rassm/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AlertIcon, ArrowRightIcon, BoxIcon, TruckIcon, UserIcon } from "@/components/ui/icons";
import { formatTableDate } from "@/lib/admin/format";
import { adminRoutes } from "@/lib/admin/routes";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fetchDashboardStats } from "@/lib/data/admin";
import { AdminEmpty, AdminPageHeader, InitialAvatar, adminLabel } from "./admin-ui";
import { StatusBadge } from "./badges";
import { MetricSwitch, SalesChart, StatusDonut, type SalesMetric } from "./dashboard-charts";
import {
  LinkCard,
  MetricTile,
  RangePicker,
  StatCard,
  StatLabel,
  formatAmount,
  formatNumber,
  formatRate,
  formatRatio,
  previousLabel,
  useStatsRange,
} from "./stats-ui";

// Tableau de bord (design/admin-dashboard.png): every widget follows the chosen period and
// every number comes from the API (MongoDB aggregations). Trends compare with the period of
// the same length just before, and are hidden when that period had no orders.

/** "3 commandes livrées": every word of the phrase takes the plural. */
const plural = (count: number, phrase: string) =>
  `${formatNumber(count)} ${count > 1 ? phrase.replace(/(\p{L}+)/gu, "$1s") : phrase}`;

function Card({
  title,
  info,
  action,
  children,
  className,
}: {
  title: string;
  info: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-md border border-line bg-paper p-4 sm:p-6", className)}>
      <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3">
        <StatLabel label={title} info={info} />
        {action}
      </div>
      {children}
    </section>
  );
}

function SeeAll({ href, label = "Voir tout" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-9 items-center gap-2 text-sm hover:underline hover:underline-offset-4"
    >
      {label} <ArrowRightIcon width={16} height={16} />
    </Link>
  );
}

export function DashboardPage() {
  const { range, today, setPreset, setCustom } = useStatsRange("30d");
  const [metric, setMetric] = useState<SalesMetric>("revenue");
  const query = useQuery({
    queryKey: ["admin", "stats", range.from, range.to],
    queryFn: () => fetchDashboardStats({ from: range.from, to: range.to }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;

  return (
    <>
      <AdminPageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre boutique"
        actions={
          <RangePicker
            key={`${range.from}-${range.to}`}
            range={range}
            today={today}
            onPreset={setPreset}
            onCustom={setCustom}
          />
        }
      />

      {query.isPending ? (
        <div className="mt-7">
          <AdminEmpty>Calcul des statistiques…</AdminEmpty>
        </div>
      ) : query.isError || !data ? (
        <div className="mt-7">
          <AdminEmpty tone="error">
            {query.error instanceof ApiError
              ? query.error.message
              : "Impossible de charger les statistiques."}
          </AdminEmpty>
        </div>
      ) : (
        <div className={cn("transition-opacity", query.isPlaceholderData && "opacity-60")}>
          <Dashboard data={data} metric={metric} onMetric={setMetric} />
        </div>
      )}
    </>
  );
}

function Dashboard({
  data,
  metric,
  onMetric,
}: {
  data: DashboardStats;
  metric: SalesMetric;
  onMetric: (metric: SalesMetric) => void;
}) {
  const { kpis, performance, ads, range } = data;
  const compared = range.hasPrevious
    ? previousLabel(range.previousFrom, range.previousTo)
    : undefined;
  const trendNote = range.hasPrevious
    ? ` La tendance compare avec la période précédente de même durée (${formatNumber(
        Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000 + 1),
      )} jours).`
    : " Pas de tendance : la période précédente n'a aucune commande.";

  return (
    <>
      {/* KPI cards */}
      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Commandes"
          value={formatNumber(kpis.orders.value)}
          stat={kpis.orders}
          previousTitle={compared}
          info={<p>Commandes passées sur la période, tous statuts confondus.{trendNote}</p>}
        />
        <StatCard
          label="Chiffre d'affaires"
          value={formatPrice(kpis.revenue.value)}
          stat={kpis.revenue}
          previousTitle={compared}
          info={
            <>
              <p>
                Encaissé : prix des articles des commandes livrées de la période (hors frais de
                livraison, reversés à Anderson).
              </p>
              <p className="mt-1.5">
                En attente : articles des commandes confirmées et expédiées, pas encore payées.
                {trendNote}
              </p>
            </>
          }
        >
          <p className="mt-1.5 text-[13px] text-stone">
            en attente : {formatPrice(kpis.pendingRevenue)}
          </p>
        </StatCard>
        <StatCard
          label="Bénéfice net"
          value={formatPrice(kpis.profit.value)}
          stat={kpis.profit}
          previousTitle={compared}
          info={
            <>
              <p>
                Commandes livrées : articles − prix de revient × quantité − réduction de livraison −
                emballage. Moins, pour les retours : coût du retour + emballage. Moins la publicité
                de la période.
              </p>
              <p className="mt-1.5">
                Marge = bénéfice ÷ encaissé. Emballage et retour : valeurs enregistrées sur chaque
                commande quand elle est livrée ou retournée (Paramètres).{trendNote}
              </p>
            </>
          }
        >
          <p
            className={cn(
              "mt-1.5 text-[13px]",
              kpis.profit.value < 0 ? "text-error" : "text-stone",
            )}
          >
            marge : {formatRate(kpis.margin)}
          </p>
        </StatCard>
        <StatCard
          label="Clients"
          value={formatNumber(kpis.clients.value)}
          stat={kpis.clients}
          previousTitle={compared}
          info={
            <p>Numéros de téléphone différents parmi les commandes de la période.{trendNote}</p>
          }
        />
      </div>

      {data.missingCosts > 0 && (
        <div
          role="status"
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-warning/40 bg-warning/8 px-4 py-3 text-sm text-warning"
        >
          <AlertIcon width={18} height={18} className="shrink-0" />
          <p className="flex-1">
            {plural(data.missingCosts, "commande livrée")} sans prix de revient : le bénéfice ne
            compte pas leur coût d&apos;achat et paraît plus élevé.
          </p>
          <Link href={adminRoutes.products} className="font-semibold underline underline-offset-4">
            Renseigner les prix de revient
          </Link>
        </div>
      )}

      {/* Sales chart and statuses */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          title="Ventes"
          info={
            <p>
              Par{" "}
              {range.granularity === "day"
                ? "jour"
                : range.granularity === "week"
                  ? "semaine (du lundi)"
                  : "mois"}
              , selon la date de la commande. Encaissé : articles des commandes livrées. Commandes
              passées : toutes les commandes. Bénéfice : même calcul que la carte Bénéfice net,
              publicité répartie par jour.
            </p>
          }
          action={<MetricSwitch value={metric} onChange={onMetric} />}
        >
          <SalesChart series={data.series} granularity={range.granularity} metric={metric} />
        </Card>
        <Card
          title="Statut des commandes"
          info={<p>Statut actuel des commandes passées sur la période.</p>}
        >
          <StatusDonut statuses={data.statuses} />
        </Card>
      </div>

      {/* Latest orders and best sellers */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          title="Dernières commandes"
          info={<p>Les 5 commandes les plus récentes de la période.</p>}
          action={<SeeAll href={adminRoutes.orders + "?statut=all"} />}
        >
          <LatestOrders orders={data.latestOrders} />
        </Card>
        <Card
          title="Produits les plus vendus"
          info={
            <p>
              Articles vendus (commandes confirmées, expédiées et livrées) par produit et couleur.
              Bénéfice : commandes livrées, calculé comme le bénéfice net (hors publicité) ; « — »
              quand un prix de revient manque. Stock : unités restantes de cette couleur
              aujourd&apos;hui.
            </p>
          }
          action={<SeeAll href={adminRoutes.products} />}
        >
          <TopProducts products={data.topProducts} />
        </Card>
      </div>

      {/* Performance */}
      <h2 className={cn(adminLabel, "mt-8 mb-3 text-ash")}>Performance</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.35fr)]">
        <MetricTile
          label="Taux de confirmation"
          value={formatRate(performance.confirmationRate.value)}
          detail={
            <>
              <p>
                {formatNumber(performance.confirmationRate.numerator)} sur{" "}
                {plural(performance.confirmationRate.denominator, "commande traitée")}
              </p>
              <p className="mt-0.5 text-xs">
                Annulées après confirmation : {formatNumber(performance.cancelledAfterConfirmation)}
              </p>
            </>
          }
          info={
            <>
              <p>
                Commandes confirmées au moins une fois (historique des statuts), même si elles ont
                été annulées ou retournées ensuite, ÷ toutes les commandes sauf celles encore
                nouvelles.
              </p>
              <p className="mt-1.5">
                Annulées après confirmation : commandes annulées alors qu'elles avaient été
                confirmées.
              </p>
            </>
          }
        />
        <MetricTile
          label="Taux de livraison"
          value={formatRate(performance.deliveryRate.value)}
          detail={`${formatNumber(performance.deliveryRate.numerator)} livrées sur ${formatNumber(performance.deliveryRate.denominator)}`}
          info={<p>Commandes livrées ÷ (livrées + retournées).</p>}
        />
        <MetricTile
          label="Commandes retournées"
          value={formatNumber(performance.returns.count)}
          tone={performance.returns.count > 0 ? "error" : undefined}
          detail={`coût : ${formatPrice(performance.returns.cost)}`}
          info={
            <p>
              Commandes retournées de la période. Coût : frais de retour + emballage enregistrés sur
              chaque retour (Paramètres).
            </p>
          }
        />
        <MetricTile
          label="Réductions livraison"
          value={formatPrice(performance.discounts.total)}
          detail={plural(performance.discounts.freeDeliveryOrders, "livraison gratuite")}
          info={
            <p>
              Réductions de livraison accordées sur les commandes livrées (paliers par quantité), et
              nombre de commandes livrées avec la livraison gratuite.
            </p>
          }
        />
        <TopWilayas wilayas={performance.topWilayas} total={kpis.orders.value} />
      </div>

      {/* Ads */}
      <div className="mt-8 mb-3 flex items-center justify-between gap-3">
        <h2 className={cn(adminLabel, "text-ash")}>Publicité</h2>
        <SeeAll href={adminRoutes.ads} label="Gérer les dépenses" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Dépenses"
          value={formatPrice(ads.spend)}
          info={
            <p>
              Dépenses publicitaires saisies dans la page Publicité, réparties à parts égales sur
              chaque jour de leur période.
            </p>
          }
        />
        <MetricTile
          label="Coût par commande"
          value={formatAmount(ads.costPerOrder)}
          detail={plural(ads.orders, "commande")}
          info={<p>Dépenses ÷ commandes passées sur la période.</p>}
        />
        <MetricTile
          label="Coût par commande livrée"
          value={formatAmount(ads.costPerDeliveredOrder)}
          detail={plural(ads.deliveredOrders, "commande livrée")}
          info={<p>Dépenses ÷ commandes livrées (passées sur la période).</p>}
        />
        <MetricTile
          label="ROAS"
          value={formatRatio(ads.roas)}
          detail={ads.roas === null ? "aucune dépense saisie" : "DA encaissés pour 1 DA dépensé"}
          info={<p>Chiffre d&apos;affaires encaissé ÷ dépenses publicitaires.</p>}
        />
      </div>

      {/* Bottom cards */}
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <BottomLink href={`${adminRoutes.products}?statut=low`}>
          <LinkCard
            icon={BoxIcon}
            label="Stock faible"
            value={formatNumber(data.stock.lowStockProducts)}
            detail={`produit${data.stock.lowStockProducts > 1 ? "s" : ""} à ${formatNumber(data.stock.threshold)} unités ou moins`}
          />
        </BottomLink>
        <BottomLink href={`${adminRoutes.orders}?statut=delivered`}>
          <LinkCard
            icon={TruckIcon}
            label="Livraison"
            value={formatRate(performance.deliveryRate.value)}
            detail="taux de livraison sur la période"
          />
        </BottomLink>
        <BottomLink href={adminRoutes.clients}>
          <LinkCard
            icon={UserIcon}
            label="Clients"
            value={formatNumber(data.clientsTotal)}
            detail="clients au total"
          />
        </BottomLink>
      </div>
    </>
  );
}

function BottomLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-md border border-line bg-paper p-4 hover:border-ink/60 sm:p-5"
    >
      <div className="min-w-0 flex-1">{children}</div>
      <ArrowRightIcon
        width={20}
        height={20}
        className="shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function LatestOrders({ orders }: { orders: DashboardStats["latestOrders"] }) {
  if (orders.length === 0) return <AdminEmpty>Aucune commande sur cette période.</AdminEmpty>;
  return (
    <div>
      <div
        className={cn(
          adminLabel,
          "hidden grid-cols-[4.5rem_minmax(0,1fr)_4.5rem_6rem_6.5rem_4.5rem] gap-x-3 border-b border-line pb-2.5 md:grid",
        )}
      >
        <span>N°</span>
        <span>Client</span>
        <span>Produit</span>
        <span>Total</span>
        <span>Statut</span>
        <span>Date</span>
      </div>
      <ul className="divide-y divide-line">
        {orders.map((order) => {
          const date = formatTableDate(order.createdAt);
          return (
            <li
              key={order.id}
              className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3 hover:bg-cream/40 md:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem_6rem_6.5rem_4.5rem] md:gap-x-3"
            >
              <span className="order-2 text-xs text-stone tabular-nums md:order-none md:text-sm md:text-ash">
                {order.orderNumber.replace("RSM-", "#")}
              </span>
              <div className="order-1 flex min-w-0 items-center gap-3 md:order-none">
                <InitialAvatar name={order.fullName} size="sm" />
                <Link
                  href={adminRoutes.order(order.id)}
                  className="truncate text-[15px] font-semibold after:absolute after:inset-0 after:content-[''] md:font-normal"
                >
                  {order.fullName}
                </Link>
              </div>
              <div className="order-3 col-span-2 flex min-w-0 items-center gap-2.5 md:order-none md:col-span-1">
                <span className="relative size-10 shrink-0 overflow-hidden rounded-sm bg-cream">
                  {order.image && (
                    <Image src={order.image} alt="" fill sizes="40px" className="object-contain" />
                  )}
                </span>
                <span className="truncate text-sm text-ash md:sr-only">{order.productName}</span>
              </div>
              <span className="order-4 text-[15px] font-semibold tabular-nums md:order-none md:font-normal">
                {formatPrice(order.total)}
              </span>
              <span className="order-5 justify-self-end md:order-none md:justify-self-start">
                <StatusBadge status={order.status} />
              </span>
              <time
                dateTime={order.createdAt}
                className="order-6 col-span-2 text-xs text-stone tabular-nums md:order-none md:col-span-1 md:text-sm md:text-ash"
              >
                {date.day}
                <span className="md:hidden"> · </span>
                <span className="md:block">{date.time}</span>
              </time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TopProducts({ products }: { products: DashboardStats["topProducts"] }) {
  if (products.length === 0) return <AdminEmpty>Aucune vente sur cette période.</AdminEmpty>;
  return (
    <ol className="divide-y divide-line">
      {products.map((product, index) => {
        const stockTone =
          product.stock === null
            ? "text-stone"
            : product.stock === 0
              ? "text-error"
              : product.stock <= 5
                ? "text-warning"
                : "text-success";
        return (
          <li
            key={`${product.productId}-${product.color}`}
            className="relative flex items-center gap-3 py-3 hover:bg-cream/40"
          >
            <span className="w-4 shrink-0 text-sm text-stone tabular-nums">{index + 1}</span>
            <span className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-cream">
              {product.image && (
                <Image src={product.image} alt="" fill sizes="48px" className="object-contain" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={adminRoutes.product(product.productId)}
                className="block truncate text-[15px] after:absolute after:inset-0 after:content-['']"
              >
                {product.name}
              </Link>
              <p className="truncate text-[13px] text-stone">{product.color}</p>
            </div>
            <div className="shrink-0 text-right text-[13px] tabular-nums">
              <p className="text-sm">{plural(product.units, "vendu")}</p>
              <p className="text-stone" title="Bénéfice des articles livrés">
                {product.profit === null
                  ? "bénéfice : —"
                  : `bénéfice : ${formatPrice(product.profit)}`}
              </p>
              <p className={stockTone}>
                {product.stock === null ? "Stock : —" : `Stock : ${formatNumber(product.stock)}`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TopWilayas({
  wilayas,
  total,
}: {
  wilayas: DashboardStats["performance"]["topWilayas"];
  total: number;
}) {
  const max = Math.max(1, ...wilayas.map((wilaya) => wilaya.orders));
  return (
    <section className="min-w-0 rounded-md border border-line bg-paper p-4 sm:col-span-2 sm:p-5 xl:col-span-1">
      <StatLabel
        label="Top 5 wilayas"
        info={<p>Wilayas avec le plus de commandes sur la période (tous statuts).</p>}
      />
      {wilayas.length === 0 ? (
        <p className="mt-3 text-sm text-stone">Aucune commande sur cette période.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {wilayas.map((wilaya) => (
            <li
              key={wilaya.code}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-2.5 text-[13px]"
            >
              <span className="truncate">{getWilaya(wilaya.code)?.name ?? wilaya.code}</span>
              <span className="h-2 overflow-hidden rounded-full bg-chart-grid" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-chart-series"
                  style={{ width: `${(wilaya.orders / max) * 100}%` }}
                />
              </span>
              <span
                className="text-right tabular-nums"
                title={total ? formatRate(wilaya.orders / total) : undefined}
              >
                {formatNumber(wilaya.orders)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
