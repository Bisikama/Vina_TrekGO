import { apiRequest } from "@/lib/api-client";

import {
  DeliveryTaskDetail,
  DeliveryTaskSummary,
  PaginatedResult,
  RentalAvailability,
  RentalCancellationPreview,
  RentalCancellationResult,
  RentalCategory,
  RentalDepositStatus,
  RentalHandoverPreview,
  RentalOrderDetail,
  RentalOrderCreated,
  RentalOrderSummary,
  RentalPaymentCheckout,
  RentalPaymentGateway,
  RentalPaymentOptions,
  RentalPaymentStatus,
  RentalPickupCode,
  RentalProduct,
  RentalQuote,
  RentalReturnObservationResult,
  RentalReturnReceipt,
  RentalReturnScanResult,
  RentalReturnTransferResult,
  RentalTripOption,
} from "@/features/rentals/types";

type Envelope<T> = T | { data: T };

type BookingListItem = {
  id: string;
  status: string;
  trip: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
  };
};

type BookingListResult = {
  items: BookingListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type PrivateTrip = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
};

type PrivateTripListResult = {
  items: PrivateTrip[];
  total: number;
  page: number;
  pageSize: number;
};

type EligibilityResult = {
  eligible: boolean;
  reason?: string;
  cutoffAt?: string;
  membershipRef?: string;
  rentalEligible?: boolean;
  contextVersion?: number;
};

type MediaDelivery = {
  url: string;
};

type KnownTripDetail = {
  title: string;
  type: "PUBLIC" | "PRIVATE";
  startAt: string;
  endAt: string;
};

async function getKnownTripDetails(accessToken: string) {
  const [bookingResult, privateTripResult] = await Promise.allSettled([
    apiRequest<Envelope<BookingListResult>>(
      "/api/v1/bookings?page=1&pageSize=100",
      { method: "GET", accessToken },
    ),
    apiRequest<Envelope<PrivateTripListResult>>(
      "/api/v1/me/private-trips?page=1&pageSize=100",
      { method: "GET", accessToken },
    ),
  ]);

  const entries: [string, KnownTripDetail][] = [];

  if (bookingResult.status === "fulfilled") {
    unwrap(bookingResult.value).items.forEach((booking) => {
      entries.push([
        booking.trip.id,
        {
          title: booking.trip.title,
          type: "PUBLIC",
          startAt: booking.trip.startAt,
          endAt: booking.trip.endAt,
        },
      ]);
    });
  }

  if (privateTripResult.status === "fulfilled") {
    unwrap(privateTripResult.value).items.forEach((trip) => {
      entries.push([
        trip.id,
        {
          title: trip.title,
          type: "PRIVATE",
          startAt: trip.startAt,
          endAt: trip.endAt,
        },
      ]);
    });
  }

  return new Map(entries);
}

function attachTripTitle<T extends RentalOrderSummary>(
  order: T,
  trips: Map<string, KnownTripDetail>,
): T {
  const knownTrip = trips.get(order.tripId);
  const title = order.trip?.title?.trim() || knownTrip?.title;
  if (!title) return order;

  return {
    ...order,
    trip: {
      ...order.trip,
      id: order.trip?.id || order.tripId,
      title,
      type: order.trip?.type || knownTrip?.type,
      startAt: order.trip?.startAt || knownTrip?.startAt,
      endAt: order.trip?.endAt || knownTrip?.endAt,
    },
  };
}

function unwrap<T>(payload: Envelope<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: T }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });

  return params.toString();
}

async function resolveProductImage(
  product: RentalProduct,
  variant: "CATALOG_CARD" | "CATALOG_DETAIL",
) {
  if (!product.imageMediaIds.length) return product;

  const deliveries = await Promise.allSettled(
    product.imageMediaIds.map((mediaId) =>
      apiRequest<Envelope<MediaDelivery>>(
        `/api/v1/media/${mediaId}/delivery?variant=${variant}&format=AUTO`,
      ),
    ),
  );
  const imageUrls = deliveries.flatMap((delivery) =>
    delivery.status === "fulfilled" ? [unwrap(delivery.value).url] : [],
  );

  return imageUrls.length
    ? { ...product, imageUrl: imageUrls[0], imageUrls }
    : product;
}

async function getResolvedProduct(productId: string) {
  const response = await apiRequest<Envelope<RentalProduct>>(
    `/api/v1/rental-products/${productId}`,
  );
  return resolveProductImage(unwrap(response), "CATALOG_DETAIL");
}

async function getEligibility(
  tripId: string,
  accessToken: string,
): Promise<EligibilityResult> {
  const response = await apiRequest<Envelope<EligibilityResult>>(
    `/api/v1/trips/${tripId}/rental-eligibility`,
    { method: "GET", accessToken },
  );

  return unwrap(response);
}

async function attachEligibility(
  trip: Omit<RentalTripOption, "eligible">,
  accessToken: string,
): Promise<RentalTripOption> {
  try {
    const eligibility = await getEligibility(trip.id, accessToken);
    return {
      ...trip,
      eligible: eligibility.eligible,
      eligibilityReason: eligibility.reason,
      rentalCutoffAt: eligibility.cutoffAt,
      membershipRef: eligibility.membershipRef,
      contextVersion: eligibility.contextVersion,
    };
  } catch (error) {
    return {
      ...trip,
      eligible: false,
      eligibilityReason:
        error instanceof Error
          ? error.message
          : "Không thể kiểm tra điều kiện thuê.",
    };
  }
}

export const rentalApi = {
  async listCategories() {
    const response = await apiRequest<
      Envelope<PaginatedResult<RentalCategory>>
    >("/api/v1/rental-categories?page=1&pageSize=100");

    return unwrap(response);
  },

  async listProducts(input?: { search?: string; categoryId?: string }) {
    const query = queryString({
      page: 1,
      pageSize: 100,
      search: input?.search?.trim(),
      categoryId: input?.categoryId,
    });
    const response = await apiRequest<Envelope<PaginatedResult<RentalProduct>>>(
      `/api/v1/rental-products?${query}`,
    );
    const result = unwrap(response);

    return {
      ...result,
      items: await Promise.all(
        result.items.map((product) =>
          resolveProductImage(product, "CATALOG_CARD"),
        ),
      ),
    };
  },

  async getProduct(productId: string) {
    return getResolvedProduct(productId);
  },

  async listTripOptions(accessToken: string) {
    // Candidate sources only. The Rental eligibility endpoint remains the
    // single authority for whether a trip may be used to rent equipment.
    const [bookingResult, privateTripResult] = await Promise.allSettled([
      apiRequest<Envelope<BookingListResult>>(
        "/api/v1/bookings?page=1&pageSize=50",
        { method: "GET", accessToken },
      ),
      apiRequest<Envelope<PrivateTripListResult>>("/api/v1/me/private-trips?page=1&pageSize=50", {
        method: "GET",
        accessToken,
      }),
    ]);

    const now = Date.now();
    const bookings =
      bookingResult.status === "fulfilled"
        ? unwrap(bookingResult.value)
            .items.filter(
              (booking) => new Date(booking.trip.endAt).getTime() > now,
            )
            .map((booking) => ({
              id: booking.trip.id,
              title: booking.trip.title,
              type: "PUBLIC" as const,
              startAt: booking.trip.startAt,
              endAt: booking.trip.endAt,
              sourceStatus: booking.status,
            }))
        : [];

    const privateTrips =
      privateTripResult.status === "fulfilled"
        ? unwrap(privateTripResult.value)
            .items.filter(
              (trip) =>
                ["OPEN", "FULL", "CLOSED"].includes(trip.status) &&
                new Date(trip.endAt).getTime() > now,
            )
            .map((trip) => ({
              id: trip.id,
              title: trip.title,
              type: "PRIVATE" as const,
              startAt: trip.startAt,
              endAt: trip.endAt,
              sourceStatus: trip.status,
            }))
        : [];

    if (
      bookingResult.status === "rejected" &&
      privateTripResult.status === "rejected"
    ) {
      throw bookingResult.reason;
    }

    const uniqueTrips = Array.from(
      new Map(
        [...bookings, ...privateTrips].map((trip) => [trip.id, trip]),
      ).values(),
    );

    return Promise.all(
      uniqueTrips.map((trip) => attachEligibility(trip, accessToken)),
    );
  },

  getEligibility,

  async getAvailability(
    input: { tripId: string; productId: string },
    accessToken: string,
  ) {
    const query = queryString(input);
    const response = await apiRequest<Envelope<RentalAvailability>>(
      `/api/v1/rentals/availability?${query}`,
      { method: "GET", accessToken },
    );

    return unwrap(response);
  },

  async createQuote(
    input: {
      tripId: string;
      items: { productId: string; quantity: number }[];
    },
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<RentalQuote>>(
      "/api/v1/rentals/quote",
      {
        method: "POST",
        accessToken,
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },

  async createOrder(
    quoteId: string,
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<RentalOrderCreated>>(
      "/api/v1/rental-orders",
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ quoteId }),
      },
    );

    return unwrap(response);
  },

  async listOrders(
    accessToken: string,
    input?: { status?: string; bookingId?: string; page?: number; pageSize?: number },
  ) {
    const query = queryString({
      status: input?.status,
      bookingId: input?.bookingId,
      page: input?.page ?? 1,
      pageSize: input?.pageSize ?? 20,
    });
    const response = await apiRequest<
      Envelope<PaginatedResult<RentalOrderSummary>>
    >(`/api/v1/rental-orders?${query}`, { method: "GET", accessToken });

    const result = unwrap(response);
    const trips = await getKnownTripDetails(accessToken);

    return {
      ...result,
      items: result.items.map((order) => attachTripTitle(order, trips)),
    };
  },

  async getOrder(orderId: string, accessToken: string) {
    const response = await apiRequest<Envelope<RentalOrderDetail>>(
      `/api/v1/rental-orders/${orderId}`,
      { method: "GET", accessToken },
    );

    const result = unwrap(response);
    const trips = await getKnownTripDetails(accessToken);

    const products = await Promise.allSettled(
      [...new Set(result.items.map((item) => item.productId))].map((productId) =>
        getResolvedProduct(productId),
      ),
    );
    const productMap = new Map(
      products.flatMap((entry) =>
        entry.status === "fulfilled" ? [[entry.value.id, entry.value] as const] : [],
      ),
    );

    return {
      ...result,
      order: attachTripTitle(result.order, trips),
      items: result.items.map((item) => {
        const product = productMap.get(item.productId);
        return product
          ? {
              ...item,
              name: item.name || product.name,
              sku: item.sku || product.sku,
              imageUrl: item.imageUrl || product.imageUrl,
              product: {
                ...item.product,
                id: item.product?.id || product.id,
                name: item.product?.name || product.name,
                sku: item.product?.sku || product.sku,
                imageUrl: item.product?.imageUrl || product.imageUrl,
              },
            }
          : item;
      }),
    };
  },

  async previewCancellation(orderId: string, accessToken: string) {
    const response = await apiRequest<Envelope<RentalCancellationPreview>>(
      `/api/v1/rental-orders/${orderId}/cancellation-preview`,
      { method: "GET", accessToken },
    );

    return unwrap(response);
  },

  async cancelOrder(
    orderId: string,
    input: {
      reason: string;
      previewVersion: string;
      expectedVersion: number;
    },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<RentalCancellationResult>>(
      `/api/v1/rental-orders/${orderId}/cancel`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },

  async listDeliveryTasks(
    accessToken: string,
    input?: { type?: "OUTBOUND" | "RETURN"; status?: string; page?: number; pageSize?: number },
  ) {
    const query = queryString({
      type: input?.type,
      status: input?.status,
      page: input?.page ?? 1,
      pageSize: input?.pageSize ?? 50,
    });
    const response = await apiRequest<Envelope<PaginatedResult<DeliveryTaskSummary>>>(
      `/api/v1/delivery/tasks?${query}`,
      { method: "GET", accessToken },
    );

    const result = unwrap(response);
    const trips = await getKnownTripDetails(accessToken);

    const orderIds = [
      ...new Set(
        result.items
          .filter((task) => !trips.has(task.orderSummary.tripId))
          .map((task) => task.orderSummary.orderId),
      ),
    ].slice(0, 50);
    const orderResults = await Promise.allSettled(
      orderIds.map((orderId) =>
        apiRequest<Envelope<RentalOrderDetail>>(
          `/api/v1/rental-orders/${encodeURIComponent(orderId)}`,
          { method: "GET", accessToken },
        ),
      ),
    );
    orderResults.forEach((orderResult) => {
      if (orderResult.status !== "fulfilled") return;
      const order = unwrap(orderResult.value).order;
      const trip = order.trip;
      if (!trip?.title || !trip.startAt || !trip.endAt) return;
      trips.set(order.tripId, {
        title: trip.title,
        type: order.bookingId ? "PUBLIC" : "PRIVATE",
        startAt: trip.startAt,
        endAt: trip.endAt,
      });
    });

    return {
      ...result,
      items: result.items.map((task) => {
        const trip = trips.get(task.orderSummary.tripId);
        return trip
          ? {
              ...task,
              tripTitle: trip.title,
              tripType: trip.type,
              tripStartAt: trip.startAt,
              tripEndAt: trip.endAt,
            }
          : task;
      }),
    };
  },

  async claimDeliveryTask(
    taskId: string,
    expectedVersion: number,
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<{ version: number }>>(
      `/api/v1/delivery/tasks/${taskId}/claim`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ expectedVersion }),
      },
    );

    return unwrap(response);
  },

  async getDeliveryTask(taskId: string, accessToken: string) {
    const response = await apiRequest<Envelope<DeliveryTaskDetail>>(
      `/api/v1/delivery/tasks/${taskId}`,
      { method: "GET", accessToken },
    );

    return unwrap(response);
  },

  async receiveDeliveryPackage(
    taskId: string,
    input: {
      custodyTransferId: string;
      packageCode: string;
      expectedVersion: number;
    },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<
      Envelope<{
        task: { id: string; status: string; packageReceivedAt?: string | null; version: number };
        custody: { id: string; status: string; receivedAt?: string | null };
      }>
    >(`/api/v1/delivery/tasks/${taskId}/receive-package`, {
      method: "POST",
      accessToken,
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });

    return unwrap(response);
  },

  async verifyDeliveryRecipient(
    taskId: string,
    input: { pickupCode: string; expectedVersion: number },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<
      Envelope<{
        verificationRef: string;
        recipient: Record<string, unknown>;
        expectedPackage: { id: string; code: string; version: number };
        expiresAt: string;
        taskVersion: number;
      }>
    >(`/api/v1/delivery/tasks/${taskId}/verify-user`, {
      method: "POST",
      accessToken,
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });

    return unwrap(response);
  },

  async commitRentalHandover(
    orderId: string,
    input: {
      packageId: string;
      verificationRef: string;
      recipientNotes?: string;
      reportedIssues?: { unitId?: string; type: string; description: string }[];
      expectedVersion: number;
    },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<Record<string, unknown>>>(
      `/api/v1/rental-orders/${orderId}/handover`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },

  async markRentalNoShow(
    orderId: string,
    input: {
      reason:
        | "NO_SHOW"
        | "USER_NO_SHOW"
        | "USER_CHANGED_MIND"
        | "USER_REFUSED_DISCLOSED_CONDITION"
        | "SYSTEM_WRONG_EQUIPMENT"
        | "SYSTEM_DAMAGED_EQUIPMENT"
        | "SYSTEM_MISSING_EQUIPMENT"
        | "OTHER_SYSTEM_FAULT";
      notes?: string;
      evidenceIds?: string[];
      expectedVersion: number;
    },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<Record<string, unknown>>>(
      `/api/v1/rental-orders/${orderId}/no-show`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },
  async scanRentalReturn(
    orderId: string,
    input: { assetCodes: string[]; operationId: string; expectedVersion: number },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<RentalReturnScanResult>>(
      `/api/v1/rental-orders/${orderId}/return-scan`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },

  async submitRentalReturnObservations(
    orderId: string,
    input: {
      items: {
        unitId: string;
        visibleDamage?: boolean;
        accessoryObservations?: string[];
        notes?: string;
        evidenceIds?: string[];
      }[];
      expectedVersion: number;
    },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<RentalReturnObservationResult>>(
      `/api/v1/rental-orders/${orderId}/return-observations`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },

  async finalizeRentalReturnReceipt(
    orderId: string,
    input: {
      returnSessionId: string;
      expectedVersion: number;
      remarks?: string;
      failureEvidenceId?: string;
      evidenceIds?: string[];
    },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<RentalReturnReceipt>>(
      `/api/v1/rental-orders/${orderId}/return-receipts`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },

  async transferRentalReturnToInventory(
    returnTaskId: string,
    input: {
      unitIds: string[];
      missingInCustodyUnitIds?: string[];
      incidentNote?: string;
      packageId?: string;
      pendingTransferId?: string;
      expectedVersion: number;
    },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<RentalReturnTransferResult>>(
      `/api/v1/delivery/tasks/${returnTaskId}/return-to-inventory-location`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },

  async getPaymentStatus(orderId: string, accessToken: string) {
    const response = await apiRequest<Envelope<RentalPaymentStatus>>(
      `/api/v1/rental-orders/${orderId}/payment`,
      { method: "GET", accessToken },
    );

    return unwrap(response);
  },

  async listPaymentOptions(accessToken: string) {
    const response = await apiRequest<Envelope<RentalPaymentOptions>>(
      "/api/v1/payments/options",
      { method: "GET", accessToken },
    );

    return unwrap(response);
  },

  async createPayment(
    orderId: string,
    input: {
      gateway: RentalPaymentGateway;
      paymentMethod: "REDIRECT";
    },
    idempotencyKey: string,
    accessToken: string,
  ) {
    const response = await apiRequest<Envelope<RentalPaymentCheckout>>(
      `/api/v1/rental-orders/${orderId}/payments`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    );

    return unwrap(response);
  },

  async getPickupCode(orderId: string, accessToken: string) {
    const response = await apiRequest<Envelope<RentalPickupCode>>(
      `/api/v1/rental-orders/${orderId}/pickup-code`,
      { method: "GET", accessToken },
    );

    return unwrap(response);
  },

  async getHandoverPreview(orderId: string, accessToken: string) {
    const response = await apiRequest<Envelope<RentalHandoverPreview>>(
      `/api/v1/rental-orders/${orderId}/handover-preview`,
      { method: "GET", accessToken },
    );

    return unwrap(response);
  },

  async getDepositStatus(orderId: string, accessToken: string) {
    const response = await apiRequest<Envelope<RentalDepositStatus>>(
      `/api/v1/rental-orders/${orderId}/deposit`,
      { method: "GET", accessToken },
    );

    return unwrap(response);
  },
};
