import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Plus,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  PauseCircle,
  Edit,
  MapPin,
  Trash2,
  Star,
  Store,
  X,
  UserCheck,
  Loader2,
  ShieldCheck,
  ExternalLink,
  CheckSquare,
  Square,
  User,
  QrCode,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PageHeader } from "../ui/PageHeader";
import { Pagination } from "../ui/Pagination";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { cn } from "../../../lib/utils";
import { supabase } from "../../../lib/supabase";

type RiderStatus = "active" | "inactive" | "suspended";
type AvailabilityStatus = "available" | "offline";
type VehicleType =
  | "bicycle"
  | "bike"
  | "scooter"
  | "electric_scooter";
type KycStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected";

interface Rider {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone: string;
  vehicle_type: VehicleType;
  vehicle_number: string;
  status: RiderStatus;
  availability_status: AvailabilityStatus;
  location_area: string;
  orders_completed: number;
  rating: number;
  joinedAt: string;
  assigned_vendors: { id: string; name: string }[];
  kyc_status: KycStatus;
  verification_notes: string;
  documents_updated_at: string;
  aadhaar_number: string;
  aadhaar_front_url: string;
  aadhaar_back_url: string;
  pan_number: string;
  pan_document_url: string;
  driving_license_number: string;
  driving_license_document_url: string;
  profile_photo_url: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
  qr_code_url: string;

  gender: string;
  blood_group: string;
  emergency_contact: string;
  alternate_contact: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  is_specially_abled: boolean;
  disability_type?: string;
  selfie_photo_url: string;
  selfie_locked: boolean;
  selfie_uploaded_at: string;
  rider_code?: string;
}

interface VendorOption {
  value: string;
  label: string;
}

const statusBadgeMap: Record<
  RiderStatus,
  {
    variant:
      | "success"
      | "warning"
      | "error"
      | "neutral"
      | "info";
    label: string;
  }
> = {
  active: {
    variant: "success",
    label: "Active",
  },
  inactive: {
    variant: "neutral",
    label: "Pending Approval",
  },
  suspended: {
    variant: "error",
    label: "Suspended",
  },
};

const kycBadgeMap: Record<
  KycStatus,
  {
    variant: "success" | "warning" | "error" | "neutral";
    label: string;
  }
> = {
  not_submitted: {
    variant: "neutral",
    label: "⚪ Not Submitted",
  },
  pending: {
    variant: "warning",
    label: "🟡 Pending",
  },
  verified: {
    variant: "success",
    label: "🟢 Verified",
  },
  rejected: {
    variant: "error",
    label: "🔴 Rejected",
  },
};

const vehicleLabelMap: Record<VehicleType, string> = {
  bicycle: "Bicycle",
  bike: "Motorcycle",
  scooter: "Scooter",
  electric_scooter: "EV Scooter",
};

const QUICK_REJECT_REASONS = [
  "Aadhaar front or back unclear",
  "PAN image unclear",
  "Selfie photo unclear or mismatch",
  "Driving licence invalid",
  "Bank details mismatch",
  "Other",
];

const SUPABASE_ANON_KEY =
  ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? "") as string;

function PortalDropdown({
  trigger,
  items,
}: {
  trigger: React.ReactNode;
  items: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: "danger" | "default";
  }[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
  });

  const triggerRef = React.useRef<HTMLDivElement>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const targetNode = event.target as Node;

      const clickedTrigger =
        triggerRef.current &&
        triggerRef.current.contains(targetNode);

      const clickedPortal =
        portalRef.current &&
        portalRef.current.contains(targetNode);

      if (!clickedTrigger && !clickedPortal) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener(
        "mousedown",
        handleOutsideClick
      );
    }

    return () =>
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
  }, [isOpen]);

  const toggleDropdown = (
    gridEvent: React.MouseEvent
  ) => {
    gridEvent.preventDefault();
    gridEvent.stopPropagation();

    if (triggerRef.current) {
      const rect =
        triggerRef.current.getBoundingClientRect();

      setCoords({
        top:
          rect.bottom +
          window.scrollY,
        left:
          rect.right -
          176 +
          window.scrollX,
      });
    }

    setIsOpen(!isOpen);
  };

  return (
    <div
      ref={triggerRef}
      className="inline-block"
    >
      <div
        onClick={toggleDropdown}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={portalRef}
            style={{
              position: "absolute",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className="w-44 bg-card border border-border rounded-xl shadow-xl p-1 z-[99999] text-foreground origin-top-right scale-100 transition-all"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  item.onClick();
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg text-left hover:bg-muted transition-colors cursor-pointer select-none",
                  item.variant === "danger"
                    ? "text-rose-500 hover:bg-rose-500/10"
                    : "text-foreground"
                )}
              >
                {item.icon && (
                  <span className="w-3.5 h-3.5 shrink-0 opacity-80">
                    {item.icon}
                  </span>
                )}

                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

export function Riders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [riderList, setRiderList] =
    useState<Rider[]>([]);

  const [vendorOptions, setVendorOptions] =
    useState<VendorOption[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [addOpen, setAddOpen] =
    useState(false);

  const [editOpen, setEditOpen] =
    useState(false);

  const [assignmentOpen, setAssignmentOpen] =
    useState(false);

  const [viewRider, setViewRider] =
    useState<Rider | null>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [kycOpen, setKycOpen] =
    useState(false);

  const [kycRider, setKycRider] =
    useState<Rider | null>(null);

  const [rejectConfirmOpen, setRejectConfirmOpen] =
    useState(false);

  const [rejectReason, setRejectReason] =
    useState("");

  const [formName, setFormName] =
    useState("");

  const [formEmail, setFormEmail] =
    useState("");

  const [formPhone, setFormPhone] =
    useState("");

  const [formVehicleType, setFormVehicleType] =
    useState<VehicleType>("bike");

  const [formVehicleNumber, setFormVehicleNumber] =
    useState("");

  const [formLocation, setFormLocation] =
    useState("");

  const [formStatus, setFormStatus] =
    useState<RiderStatus>("inactive");

  const [formVendors, setFormVendors] =
    useState<
      {
        id: string;
        name: string;
      }[]
    >([]);

  const itemsPerPage = 10;

  async function fetchVendorOptions() {
    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, shop_name")
        .order("shop_name", {
          ascending: true,
        });

      if (error) throw error;

      setVendorOptions(
        (data || []).map((v) => ({
          value: v.id,
          label:
            v.shop_name ||
            "Unnamed Shop",
        }))
      );
    } catch (err) {
      console.error(
        "Failed loading vendors:",
        err
      );
    }
  }

  async function fetchRiders() {
    try {
      const {
        data: ridersData,
        error: ridersError,
      } = await supabase
        .from("riders")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (ridersError) throw ridersError;

      const {
        data: profilesData,
        error: profilesError,
      } = await supabase
        .from("rider_profiles")
        .select("*");

      if (profilesError) {
        console.error(
          "Error fetching rider profiles:",
          profilesError
        );
      }

      const {
        data: assignmentsData,
        error: assignmentsError,
      } = await supabase
        .from("rider_vendor_assignments")
        .select(`
          rider_id,
          vendor_id,
          vendors:vendor_id (
            shop_name
          )
        `);

      if (assignmentsError) {
        throw assignmentsError;
      }

      const mapped: Rider[] =
        (ridersData || []).map(
          (row) => {
            const matchedAssignments =
              (assignmentsData || [])
                .filter(
                  (a) =>
                    a.rider_id ===
                      row.id &&
                    a.vendors
                )
                .map((a: any) => ({
                  id: a.vendor_id,
                  name:
                    a.vendors.shop_name ||
                    "Unnamed Shop",
                }));

            const prof =
              (profilesData || []).find(
                (p) =>
                  p.rider_id ===
                  row.id
              ) || {};

            const photoUrl =
              row.selfie_photo_url ||
              prof.selfie_photo_url ||
              row.profile_photo_url ||
              prof.profile_photo_url ||
              "";

            return {
              id: row.id,
              auth_user_id:
                row.auth_user_id || "",

              name:
                row.rider_name ||
                "Unnamed Rider",

              email:
                row.email || "—",

              phone:
                row.phone || "—",

              vehicle_type:
                (row.vehicle_type as VehicleType) ||
                "bike",

              vehicle_number:
                row.vehicle_number ||
                "—",

              status:
                (row.status as RiderStatus) ||
                "inactive",

              availability_status:
                (row.availability_status as AvailabilityStatus) ||
                "offline",

              location_area:
                row.location_area ||
                "No Area Listed",

              orders_completed:
                row.orders_completed || 0,

              rating:
                row.rating || 5.0,

              assigned_vendors:
                matchedAssignments,

              joinedAt: row.created_at
                ? new Date(
                    row.created_at
                  ).toLocaleDateString(
                    "en-GB",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }
                  )
                : "—",

              kyc_status:
                (row.kyc_status as KycStatus) ||
                "not_submitted",

              verification_notes:
                prof.rejection_reason ||
                row.verification_notes ||
                "",

              documents_updated_at:
                prof.documents_updated_at ||
                prof.updated_at ||
                row.documents_updated_at ||
                "",

              aadhaar_number:
                prof.aadhaar_number ||
                row.aadhaar_number ||
                "",

              aadhaar_front_url:
                prof.aadhaar_front_url ||
                row.aadhaar_document_url ||
                "",

              aadhaar_back_url:
                prof.aadhaar_back_url ||
                "",

              pan_number:
                prof.pan_number ||
                row.pan_number ||
                "",

              pan_document_url:
                prof.pan_card_url ||
                row.pan_document_url ||
                "",

              driving_license_number:
                prof.driving_license_number ||
                row.driving_license_number ||
                "",

              driving_license_document_url:
                prof.driving_license_url ||
                row.driving_license_document_url ||
                "",

              profile_photo_url:
                photoUrl,

              bank_name:
                prof.bank_name ||
                row.bank_name ||
                "",

              account_holder_name:
                prof.account_holder_name ||
                row.account_holder_name ||
                "",

              account_number:
                prof.account_number ||
                row.account_number ||
                "",

              ifsc_code:
                prof.ifsc_code ||
                row.ifsc_code ||
                "",

              upi_id:
                prof.upi_id ||
                row.upi_id ||
                "",

              qr_code_url:
                row.qr_code_url ||
                "",

              gender:
                row.gender || "—",

              blood_group:
                row.blood_group || "—",

              emergency_contact:
                row.emergency_contact ||
                "—",

              alternate_contact:
                row.alternate_contact ||
                "—",

              address:
                row.address || "—",

              city:
                row.city || "—",

              state:
                row.state || "—",

              pin_code:
                row.pin_code || "—",

              is_specially_abled:
                !!row.is_specially_abled,

              disability_type:
                row.disability_type || "",

              selfie_photo_url:
                row.selfie_photo_url ||
                prof.selfie_photo_url ||
                "",

              selfie_locked:
                !!row.selfie_locked,

              selfie_uploaded_at:
                row.selfie_uploaded_at ||
                "",

              rider_code:
                row.rider_code || "",
            };
          }
        );

      setRiderList(mapped);

      if (viewRider) {
        const freshTarget =
          mapped.find(
            (r) =>
              r.id === viewRider.id
          );

        if (freshTarget) {
          setViewRider(
            freshTarget
          );
        }
      }

      if (kycRider) {
        const freshKycTarget =
          mapped.find(
            (r) =>
              r.id === kycRider.id
          );

        if (freshKycTarget) {
          setKycRider(
            freshKycTarget
          );
        }
      }
    } catch (err) {
      console.error(
        "Failed fleet datastream construction mapping:",
        err
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchVendorOptions();
    fetchRiders();

    const channelRiders =
      supabase
        .channel("public:riders")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "riders",
          },
          () => fetchRiders()
        )
        .subscribe();

    const channelProfiles =
      supabase
        .channel(
          "public:rider_profiles"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "rider_profiles",
          },
          () => fetchRiders()
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channelRiders
      );

      supabase.removeChannel(
        channelProfiles
      );
    };
  }, []);

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormVehicleType("bike");
    setFormVehicleNumber("");
    setFormLocation("");
    setFormStatus("active");
    setFormVendors([]);
  }

  function handleOpenEdit(
    rider: Rider
  ) {
    setFormName(rider.name);

    setFormEmail(
      rider.email === "—"
        ? ""
        : rider.email
    );

    setFormPhone(
      rider.phone === "—"
        ? ""
        : rider.phone
    );

    setFormVehicleType(
      rider.vehicle_type
    );

    setFormVehicleNumber(
      rider.vehicle_number ===
        "—"
        ? ""
        : rider.vehicle_number
    );

    setFormLocation(
      rider.location_area ===
        "No Area Listed"
        ? ""
        : rider.location_area
    );

    setFormStatus(
      rider.status
    );

    setFormVendors(
      rider.assigned_vendors
    );

    setEditOpen(true);
  }

  function handleOpenStoreAssignment(
    rider: Rider
  ) {
    setViewRider(rider);
    setFormVendors(
      rider.assigned_vendors
    );
    setAssignmentOpen(true);
  }

  function handleSelectVendor(
    vendorId: string
  ) {
    if (
      !vendorId ||
      vendorId === ""
    ) {
      return;
    }

    const matchedOption =
      vendorOptions.find(
        (o) =>
          o.value === vendorId
      );

    if (
      matchedOption &&
      !formVendors.some(
        (v) =>
          v.id === vendorId
      )
    ) {
      setFormVendors([
        ...formVendors,
        {
          id: vendorId,
          name: matchedOption.label,
        },
      ]);
    }
  }

  async function syncVendorAssignments(
    riderId: string,
    vendorsList: {
      id: string;
      name: string;
    }[]
  ) {
    const {
      error:
        deleteJunctionError,
    } = await supabase
      .from(
        "rider_vendor_assignments"
      )
      .delete()
      .eq(
        "rider_id",
        riderId
      );

    if (
      deleteJunctionError
    ) {
      console.error(
        "Error clearing old junction rows:",
        deleteJunctionError
      );
    }

    if (
      vendorsList.length > 0
    ) {
      const batchJunctionPayload =
        vendorsList.map(
          (v) => ({
            rider_id:
              riderId,
            vendor_id:
              v.id,
          })
        );

      const {
        error:
          junctionError,
      } = await supabase
        .from(
          "rider_vendor_assignments"
        )
        .insert(
          batchJunctionPayload
        );

      if (junctionError) {
        throw junctionError;
      }
    }
  }

  async function handleAddRider() {
    if (
      !formName ||
      !formPhone ||
      !formLocation
    ) {
      alert(
        "Rider Name, Contact Phone, and Operating Area are required fields."
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        rider_name:
          formName,

        email:
          formEmail || null,

        phone:
          formPhone,

        vehicle_type:
          formVehicleType,

        vehicle_number:
          formVehicleNumber ||
          null,

        location_area:
          formLocation,

        status: "active",

        orders_completed: 0,

        rating: 5.0,
      };

      const {
        data,
        error,
      } = await supabase
        .from("riders")
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        await syncVendorAssignments(
          data.id,
          formVendors
        );
      }

      resetForm();
      setAddOpen(false);

      await fetchRiders();
    } catch (err) {
      console.error(
        "Critical onboarding write error:",
        err
      );

      alert(
        "Failed to create rider."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditRider() {
    if (!viewRider) {
      return;
    }

    if (
      !formName ||
      !formPhone ||
      !formLocation
    ) {
      alert(
        "Required profile metrics fields cannot be blank."
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        rider_name:
          formName,

        email:
          formEmail || null,

        phone:
          formPhone,

        vehicle_type:
          formVehicleType,

        vehicle_number:
          formVehicleNumber ||
          null,

        location_area:
          formLocation,

        status:
          formStatus,
      };

      const {
        error: riderError,
      } = await supabase
        .from("riders")
        .update(payload)
        .eq(
          "id",
          viewRider.id
        );

      if (riderError) {
        throw riderError;
      }

      await syncVendorAssignments(
        viewRider.id,
        formVendors
      );

      setEditOpen(false);

      await fetchRiders();
    } catch (err) {
      console.error(
        "Critical edit mutation fault context:",
        err
      );

      alert(
        "Failed to save adjustments safely."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveQuickAssignment() {
    if (!viewRider) {
      return;
    }

    try {
      setIsSubmitting(true);

      await syncVendorAssignments(
        viewRider.id,
        formVendors
      );

      setAssignmentOpen(false);
      setViewRider(null);

      await fetchRiders();
    } catch (err) {
      console.error(
        "Failed executing instant assignment modifications:",
        err
      );

      alert(
        "Could not update store connections safely."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mutateStatusDirectly(
    id: string,
    updates: Partial<
      Pick<
        Rider,
        | "status"
        | "availability_status"
      >
    >
  ) {
    const targetRider =
      riderList.find(
        (r) => r.id === id
      );

    if (
      updates.status ===
        "active" &&
      targetRider &&
      targetRider.kyc_status ===
        "not_submitted"
    ) {
      alert(
        "Cannot activate a rider whose KYC is not submitted."
      );
      return;
    }

    setRiderList(
      (prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                ...updates,
              }
            : r
        )
    );

    if (
      viewRider &&
      viewRider.id === id
    ) {
      setViewRider(
        (prev) =>
          prev
            ? {
                ...prev,
                ...updates,
              }
            : null
      );
    }

    try {
      const {
        error: updateError,
      } = await supabase
        .from("riders")
        .update(updates)
        .eq("id", id);

      if (updateError) {
        throw updateError;
      }

      if (
        updates.status ===
        "active"
      ) {
        try {
          const {
            data: riderData,
            error:
              riderFetchError,
          } = await supabase
            .from("riders")
            .select(
              "email, rider_name, rider_code"
            )
            .eq("id", id)
            .single();

          if (
            !riderFetchError &&
            riderData &&
            riderData.email
          ) {
            await fetch(
              "https://fduolwqvevmkgmicyviy.functions.supabase.co/send-email",
              {
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                  apikey:
                    SUPABASE_ANON_KEY,
                },
                body: JSON.stringify(
                  {
                    type: "rider-approved",
                    to: riderData.email,
                    riderName:
                      riderData.rider_name,
                    riderCode:
                      riderData.rider_code,
                  }
                ),
              }
            );
          }
        } catch (err) {
          console.error(
            "Rider approval email failed:",
            err
          );
        }
      }

      await fetchRiders();
    } catch (err) {
      console.error(
        "Status mutation sequence crashed:",
        err
      );

      await fetchRiders();
    }
  }

  /*
   * ============================================================
   * RIDER DELETE
   * ============================================================
   *
   * Uses the shared delete-user Edge Function.
   *
   * IMPORTANT:
   * The Edge Function expects:
   *   account_type
   *   account_id
   *
   * Do NOT use:
   *   user_type
   *   user_id
   *
   * The Edge Function handles:
   *   1. Authenticated-user verification
   *   2. Rider ownership verification
   *   3. Database deletion preparation
   *   4. Supabase Auth deletion
   *   5. Rider-related cleanup
   */

  async function handleDeleteRider(
    id: string,
    name: string
  ) {
    const check =
      window.confirm(
        `Permanently delete "${name}"? This will permanently remove the rider account and its associated records.`
      );

    if (!check) {
      return;
    }

    try {
      setIsSubmitting(true);

      /*
       * Get the currently authenticated admin/session
       * through the normal Supabase client.
       *
       * The Edge Function itself performs the actual
       * authentication and ownership validation.
       */
      const {
        data,
        error,
      } = await supabase.functions.invoke(
        "delete-user",
        {
          body: {
            account_type:
              "rider",
            account_id:
              id,
          },
        }
      );

      if (error) {
        console.error(
          "delete-user Edge Function error:",
          error
        );

        throw new Error(
          error.message ||
            "Failed to delete rider through the account deletion service."
        );
      }

      if (
        !data ||
        data.success !== true
      ) {
        throw new Error(
          data?.error ||
            "Rider account deletion failed."
        );
      }

      /*
       * Close all Rider-related modals.
       */
      setEditOpen(false);
      setAssignmentOpen(false);
      setViewRider(null);
      setKycOpen(false);
      setKycRider(null);
      setRejectConfirmOpen(false);
      setRejectReason("");

      /*
       * Refresh the fleet list.
       */
      await fetchRiders();

      alert(
        `Rider "${name}" deleted successfully.`
      );
    } catch (err: any) {
      console.error(
        "Destructive Rider deletion process failed:",
        err
      );

      alert(
        err?.message ||
          "An error occurred while deleting the rider account."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isEvOrNonMotorized = (
    vehicleType?: string
  ) => {
    return [
      "ev",
      "electric",
      "bicycle",
      "cycle",
      "electric_scooter",
    ].some((t) =>
      (vehicleType || "")
        .toLowerCase()
        .includes(t)
    );
  };

  const getKycChecklist = (
    rider: Rider | null
  ) => {
    if (!rider) {
      return {};
    }

    const dlRequired =
      !isEvOrNonMotorized(
        rider.vehicle_type
      );

    return {
      kycSelfie:
        !!rider.selfie_photo_url ||
        !!rider.profile_photo_url,

      aadhaar:
        !!(
          rider.aadhaar_number &&
          rider.aadhaar_front_url &&
          rider.aadhaar_back_url
        ),

      pan:
        !!(
          rider.pan_number &&
          rider.pan_document_url
        ),

      drivingLicense:
        !dlRequired ||
        !!(
          rider.driving_license_number &&
          rider.driving_license_document_url
        ),

      bankDetails:
        !!(
          rider.bank_name &&
          rider.account_holder_name &&
          rider.account_number &&
          rider.ifsc_code
        ),
    };
  };

  async function handleApproveKyc() {
    if (!kycRider) {
      return;
    }

    try {
      setIsSubmitting(true);

      const {
        data: latestRiderData,
        error:
          latestRiderError,
      } = await supabase
        .from("riders")
        .select("*")
        .eq(
          "id",
          kycRider.id
        )
        .single();

      if (
        latestRiderError ||
        !latestRiderData
      ) {
        throw new Error(
          "Failed to fetch latest rider data."
        );
      }

      const freshKyStatus =
        latestRiderData.kyc_status ||
        "not_submitted";

      if (
        freshKyStatus !==
        "pending"
      ) {
        alert(
          "Cannot approve a rider whose KYC is not pending submission."
        );

        setIsSubmitting(false);
        return;
      }

      const now =
        new Date().toISOString();

      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      const {
        error: updateError,
      } = await supabase
        .from("riders")
        .update({
          kyc_status:
            "verified",

          status:
            "active",

          verification_notes:
            "Verified by Admin",
        })
        .eq(
          "id",
          kycRider.id
        );

      if (updateError) {
        throw updateError;
      }

      await supabase
        .from("rider_profiles")
        .update({
          kyc_status:
            "verified",

          verified_at:
            now,

          verified_by:
            user?.id ||
            null,
        })
        .eq(
          "rider_id",
          kycRider.id
        );

      try {
        await fetch(
          "https://fduolwqvevmkgmicyviy.functions.supabase.co/send-email",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,

              apikey:
                SUPABASE_ANON_KEY,
            },

            body: JSON.stringify(
              {
                type:
                  "rider-approved",

                to:
                  latestRiderData.email,

                riderName:
                  latestRiderData.rider_name,

                riderCode:
                  latestRiderData.rider_code,
              }
            ),
          }
        );
      } catch (err) {
        console.error(
          "Rider approval email failed:",
          err
        );
      }

      if (
        latestRiderData.auth_user_id
      ) {
        await supabase
          .from("notifications")
          .insert({
            recipient_id:
              latestRiderData.auth_user_id,

            recipient_type:
              "rider",

            title:
              "✅ KYC Approved",

            message:
              "Your KYC has been approved. You can now go online and receive delivery requests.",

            type:
              "kyc",

            metadata: {},
          });
      }

      setKycOpen(false);
      setKycRider(null);

      await fetchRiders();
    } catch (err: any) {
      console.error(
        "KYC approval error:",
        err
      );

      alert(
        err?.message ||
          "Failed to finalize verification parameters."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectKyc() {
    if (!kycRider) {
      return;
    }

    if (
      kycRider.kyc_status ===
      "not_submitted"
    ) {
      alert(
        "Cannot reject KYC that has not been submitted."
      );
      return;
    }

    if (
      !rejectReason.trim()
    ) {
      alert(
        "A reason note is explicitly mandatory."
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const {
        error: updateError,
      } = await supabase
        .from("riders")
        .update({
          kyc_status:
            "rejected",

          status:
            "inactive",

          verification_notes:
            rejectReason,
        })
        .eq(
          "id",
          kycRider.id
        );

      if (updateError) {
        throw updateError;
      }

      await supabase
        .from("rider_profiles")
        .update({
          kyc_status:
            "rejected",

          rejection_reason:
            rejectReason,
        })
        .eq(
          "rider_id",
          kycRider.id
        );

      if (
        kycRider.auth_user_id
      ) {
        await supabase
          .from("notifications")
          .insert({
            recipient_id:
              kycRider.auth_user_id,

            recipient_type:
              "rider",

            title:
              "❌ KYC Rejected",

            message: `Your KYC was rejected. Reason: ${rejectReason}. Please update your documents and resubmit.`,

            type:
              "kyc",

            metadata: {},
          });
      }

      setRejectConfirmOpen(
        false
      );

      setRejectReason("");

      setKycOpen(false);
      setKycRider(null);

      await fetchRiders();
    } catch (err: any) {
      console.error(
        "KYC rejection fault:",
        err
      );

      alert(
        err?.message ||
          "Failed to submit document revision payload."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered =
    riderList.filter(
      (r) => {
        const searchLower =
          search.toLowerCase();

        const matchSearch =
          r.name
            .toLowerCase()
            .includes(
              searchLower
            ) ||
          r.location_area
            .toLowerCase()
            .includes(
              searchLower
            ) ||
          r.assigned_vendors.some(
            (v) =>
              v.name
                .toLowerCase()
                .includes(
                  searchLower
                )
          );

        let matchStatus =
          false;

        if (
          statusFilter ===
          "all"
        ) {
          matchStatus = true;
        } else if (
          statusFilter ===
          "approved"
        ) {
          matchStatus =
            r.status ===
            "active";
        } else if (
          statusFilter ===
          "pending"
        ) {
          matchStatus =
            r.status ===
            "inactive";
        } else if (
          statusFilter ===
          "suspended"
        ) {
          matchStatus =
            r.status ===
            "suspended";
        } else if (
          statusFilter ===
          "pending_kyc"
        ) {
          matchStatus =
            r.kyc_status ===
            "pending";
        } else if (
          statusFilter ===
          "verified_kyc"
        ) {
          matchStatus =
            r.kyc_status ===
            "verified";
        } else if (
          statusFilter ===
          "rejected_kyc"
        ) {
          matchStatus =
            r.kyc_status ===
            "rejected";
        } else if (
          statusFilter ===
          "not_submitted_kyc"
        ) {
          matchStatus =
            r.kyc_status ===
            "not_submitted";
        }

        return (
          matchSearch &&
          matchStatus
        );
      }
    );

  const paginated =
    filtered.slice(
      (currentPage - 1) *
        itemsPerPage,

      currentPage *
        itemsPerPage
    );

  return (
    <div className="p-4 lg:p-6 bg-background text-foreground min-h-screen">
      <PageHeader
        title="Riders Management"
        description={`${riderList.filter((r) => r.status === "active").length} fleet riders currently online`}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={
              <Plus className="w-3.5 h-3.5" />
            }
            onClick={() => {
              resetForm();
              setAddOpen(true);
            }}
          >
            Add Fleet Rider
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 my-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search fleet riders, attached shops..."
            className="w-full h-9 pl-9 pr-3 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground text-foreground focus:outline-none focus:border-[#22C55E]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 border border-border rounded-lg p-1 bg-card overflow-x-auto">
          {[
            {
              key: "all",
              label: "All Riders",
            },
            {
              key: "approved",
              label: "Active",
            },
            {
              key: "pending",
              label: "Pending Approval",
            },
            {
              key: "suspended",
              label: "Suspended",
            },
            {
              key: "pending_kyc",
              label: "Pending KYC",
            },
            {
              key: "verified_kyc",
              label: "Verified KYC",
            },
            {
              key: "rejected_kyc",
              label: "Rejected KYC",
            },
            {
              key: "not_submitted_kyc",
              label: "Not Submitted",
            },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setStatusFilter(
                  s.key
                );

                setCurrentPage(
                  1
                );
              }}
              className={cn(
                "h-7 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap",

                statusFilter ===
                  s.key
                  ? "bg-[#22C55E] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Rider
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Vehicle Model
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Assigned Shops
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status & Availability
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  KYC
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">
                  Deliveries
                </th>

                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Rating
                </th>

                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-16 text-sm text-muted-foreground"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#22C55E]" />
                      <span>
                        Loading active fleet logs...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : paginated.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-16 text-sm text-muted-foreground"
                  >
                    No matching rider records found.
                  </td>
                </tr>
              ) : (
                paginated.map(
                  (rider) => (
                    <tr
                      key={rider.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg border border-border overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                            {rider.profile_photo_url ? (
                              <img
                                src={
                                  rider.profile_photo_url
                                }
                                alt={
                                  rider.name
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground/60" />
                            )}
                          </div>

                          <div>
                            <button
                              onClick={() =>
                                setViewRider(
                                  rider
                                )
                              }
                              className="text-sm font-medium text-foreground hover:text-[#22C55E] text-left transition-colors"
                            >
                              {
                                rider.name
                              }
                            </button>

                            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3 text-muted-foreground/60" />

                              <span>
                                {
                                  rider.location_area
                                }
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {rider.gender !==
                                "—" && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                                  {
                                    rider.gender
                                  }
                                </span>
                              )}

                              {rider.blood_group !==
                                "—" && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                                  {
                                    rider.blood_group
                                  }
                                </span>
                              )}

                              {rider.is_specially_abled && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
                                  ♿ Specially Abled
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-sm text-foreground font-medium">
                          {
                            vehicleLabelMap[
                              rider.vehicle_type
                            ]
                          }
                        </div>

                        <div className="text-xs text-muted-foreground uppercase mt-0.5 tracking-wider font-semibold">
                          {
                            rider.vehicle_number
                          }
                        </div>
                      </td>

                      <td className="px-4 py-3.5 max-w-[200px]">
                        {rider.assigned_vendors.length ===
                        0 ? (
                          <span className="text-xs text-muted-foreground italic">
                            General Fleet
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-h-[45px] overflow-y-auto scrollbar-hide">
                            {rider.assigned_vendors.map(
                              (v) => (
                                <span
                                  key={
                                    v.id
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[10px] font-semibold text-foreground border border-border group/badge"
                                >
                                  <Store className="w-2.5 h-2.5 text-muted-foreground" />

                                  {
                                    v.name
                                  }

                                  <button
                                    type="button"
                                    title={`Unassign ${v.name}`}
                                    onClick={async (
                                      e
                                    ) => {
                                      e.stopPropagation();

                                      const updatedVendors =
                                        rider.assigned_vendors.filter(
                                          (
                                            item
                                          ) =>
                                            item.id !==
                                            v.id
                                        );

                                      try {
                                        await syncVendorAssignments(
                                          rider.id,
                                          updatedVendors
                                        );

                                        await fetchRiders();
                                      } catch (err) {
                                        console.error(
                                          "Quick unassign error:",
                                          err
                                        );
                                      }
                                    }}
                                    className="text-muted-foreground hover:text-red-500 ml-1 rounded-sm hover:bg-muted p-0.5 transition-colors"
                                  >
                                    <X className="w-2.5 h-2.5 stroke-[3]" />
                                  </button>
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1.5 justify-center">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-medium text-muted-foreground min-w-[72px]">
                              Status:
                            </span>

                            <Badge
                              variant={
                                statusBadgeMap[
                                  rider.status
                                ]
                                  ?.variant ||
                                "neutral"
                              }
                              label={
                                statusBadgeMap[
                                  rider.status
                                ]
                                  ?.label ||
                                rider.status
                              }
                              dot
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-medium text-muted-foreground min-w-[72px]">
                              Availability:
                            </span>

                            <Badge
                              variant={
                                rider.availability_status ===
                                "available"
                                  ? "success"
                                  : "neutral"
                              }
                              label={
                                rider.availability_status ===
                                "available"
                                  ? "Available"
                                  : "Offline"
                              }
                              dot
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge
                          variant={
                            kycBadgeMap[
                              rider.kyc_status
                            ]?.variant ||
                            "neutral"
                          }
                          label={
                            kycBadgeMap[
                              rider.kyc_status
                            ]?.label ||
                            "⚪ Not Submitted"
                          }
                        />
                      </td>

                      <td className="px-4 py-3.5 text-right font-medium text-foreground">
                        {rider.orders_completed.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />

                          <span>
                            {rider.rating.toFixed(
                              1
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center relative z-10 group-hover:z-30">
                        <PortalDropdown
                          trigger={
                            <button className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          }
                          items={[
                            {
                              label:
                                "View Details",
                              icon: (
                                <Edit className="w-3.5 h-3.5" />
                              ),
                              onClick:
                                () =>
                                  setViewRider(
                                    rider
                                  ),
                            },

                            {
                              label:
                                "View KYC",
                              icon: (
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                              ),
                              onClick:
                                () => {
                                  setKycRider(
                                    rider
                                  );
                                  setKycOpen(
                                    true
                                  );
                                },
                            },

                            {
                              label:
                                "Manage Stores",
                              icon: (
                                <Store className="w-3.5 h-3.5 text-emerald-500" />
                              ),
                              onClick:
                                () =>
                                  handleOpenStoreAssignment(
                                    rider
                                  ),
                            },

                            ...(rider.status ===
                              "inactive" &&
                            rider.kyc_status !==
                              "not_submitted"
                              ? [
                                  {
                                    label:
                                      "Approve Rider",
                                    icon: (
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    ),
                                    onClick:
                                      () =>
                                        mutateStatusDirectly(
                                          rider.id,
                                          {
                                            status:
                                              "active",
                                          }
                                        ),
                                  },
                                ]
                              : []),

                            ...(rider.availability_status !==
                            "available"
                              ? [
                                  {
                                    label:
                                      "Mark Available",
                                    icon: (
                                      <UserCheck className="w-3.5 h-3.5 text-sky-500" />
                                    ),
                                    onClick:
                                      () =>
                                        mutateStatusDirectly(
                                          rider.id,
                                          {
                                            availability_status:
                                              "available",
                                          }
                                        ),
                                  },
                                ]
                              : []),

                            ...(rider.status !==
                              "active" &&
                            rider.status !==
                              "inactive" &&
                            rider.kyc_status !==
                              "not_submitted"
                              ? [
                                  {
                                    label:
                                      "Set Active",
                                    icon: (
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    ),
                                    onClick:
                                      () =>
                                        mutateStatusDirectly(
                                          rider.id,
                                          {
                                            status:
                                              "active",
                                          }
                                        ),
                                  },
                                ]
                              : []),

                            ...(rider.availability_status ===
                            "available"
                              ? [
                                  {
                                    label:
                                      "Put Offline",
                                    icon: (
                                      <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                                    ),
                                    onClick:
                                      () =>
                                        mutateStatusDirectly(
                                          rider.id,
                                          {
                                            availability_status:
                                              "offline",
                                          }
                                        ),
                                  },
                                ]
                              : []),

                            ...(rider.status !==
                            "suspended"
                              ? [
                                  {
                                    label:
                                      "Suspend Rider",
                                    icon: (
                                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                    ),
                                    onClick:
                                      () =>
                                        mutateStatusDirectly(
                                          rider.id,
                                          {
                                            status:
                                              "suspended",
                                          }
                                        ),
                                    variant:
                                      "danger" as const,
                                  },
                                ]
                              : []),

                            {
                              label:
                                "Delete Permanent",
                              icon: (
                                <Trash2 className="w-3.5 h-3.5" />
                              ),
                              onClick:
                                () =>
                                  handleDeleteRider(
                                    rider.id,
                                    rider.name
                                  ),
                              variant:
                                "danger" as const,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={
            currentPage
          }
          totalPages={Math.max(
            1,
            Math.ceil(
              filtered.length /
                itemsPerPage
            )
          )}
          totalItems={
            filtered.length
          }
          itemsPerPage={
            itemsPerPage
          }
          onPageChange={
            setCurrentPage
          }
        />
      </div>

      {kycRider &&
        kycOpen && (
          <Modal
            open={kycOpen}
            onClose={() => {
              setKycOpen(
                false
              );
              setKycRider(
                null
              );
            }}
            title={`KYC Verification: ${kycRider.name}`}
            description="Review submitted documents, personal records, and payout configurations."
            size="md"
            footer={
              <div className="flex flex-col sm:flex-row gap-2 justify-between w-full items-center">
                <div className="flex flex-wrap items-center gap-2 mr-auto">
                  {kycRider.kyc_status ===
                    "not_submitted" && (
                    <span className="text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                      This rider has not submitted KYC yet.
                    </span>
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setKycOpen(
                        false
                      );
                      setKycRider(
                        null
                      );
                    }}
                  >
                    Close
                  </Button>

                  {kycRider.kyc_status !==
                    "not_submitted" && (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          setRejectConfirmOpen(
                            true
                          )
                        }
                        disabled={
                          isSubmitting
                        }
                      >
                        Reject KYC
                      </Button>

                      <Button
                        variant="primary"
                        onClick={
                          handleApproveKyc
                        }
                        disabled={
                          kycRider.kyc_status ===
                            "verified" ||
                          kycRider.kyc_status !==
                            "pending" ||
                          isSubmitting
                        }
                      >
                        {kycRider.kyc_status ===
                        "verified"
                          ? "Already Verified"
                          : "Approve KYC"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            }
          >
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 pt-2">
              <div className="bg-muted/30 border border-border p-3 rounded-lg flex flex-col gap-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Selfie Verification Photo
                </p>

                {kycRider.selfie_photo_url ||
                kycRider.profile_photo_url ? (
                  <div className="relative group w-32 h-32 rounded-lg border border-border overflow-hidden bg-card">
                    <img
                      src={
                        kycRider.selfie_photo_url ||
                        kycRider.profile_photo_url
                      }
                      alt="Rider Selfie"
                      className="w-full h-full object-cover"
                    />

                    <a
                      href={
                        kycRider.selfie_photo_url ||
                        kycRider.profile_photo_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-semibold gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Full
                    </a>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-amber-600 italic bg-amber-50 px-2 py-1.5 rounded border border-amber-100 w-fit">
                    Selfie Not Taken
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="bg-muted/30 border border-border p-3 rounded-lg flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground font-medium">
                      Aadhaar Card Details
                    </p>

                    <p className="text-xs font-bold text-foreground tracking-wide">
                      [Aadhaar Redacted]
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {kycRider.aadhaar_front_url ? (
                      <div className="relative group w-full h-36 rounded-lg border border-border overflow-hidden bg-card">
                        <img
                          src={
                            kycRider.aadhaar_front_url
                          }
                          alt="Aadhaar Front"
                          className="w-full h-full object-cover"
                        />

                        <a
                          href={
                            kycRider.aadhaar_front_url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-semibold gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Front View
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600 italic bg-amber-50 px-2 py-1.5 rounded border border-amber-100 flex items-center justify-center h-24">
                        Aadhaar Front Missing
                      </span>
                    )}

                    {kycRider.aadhaar_back_url ? (
                      <div className="relative group w-full h-36 rounded-lg border border-border overflow-hidden bg-card">
                        <img
                          src={
                            kycRider.aadhaar_back_url
                          }
                          alt="Aadhaar Back"
                          className="w-full h-full object-cover"
                        />

                        <a
                          href={
                            kycRider.aadhaar_back_url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-semibold gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Back View
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600 italic bg-amber-50 px-2 py-1.5 rounded border border-amber-100 flex items-center justify-center h-24">
                        Aadhaar Back Missing
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-muted/30 border border-border p-3 rounded-lg flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground font-medium">
                      PAN Card Details
                    </p>

                    <p className="text-xs font-bold text-foreground tracking-wide uppercase">
                      {kycRider.pan_number ||
                        "No Number Entered"}
                    </p>
                  </div>

                  {kycRider.pan_document_url ? (
                    <div className="relative group w-full h-36 rounded-lg border border-border overflow-hidden bg-card">
                      <img
                        src={
                          kycRider.pan_document_url
                        }
                        alt="PAN Card"
                        className="w-full h-full object-cover"
                      />

                      <a
                        href={
                          kycRider.pan_document_url
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-semibold gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Document
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-amber-600 italic bg-amber-50 px-2 py-1.5 rounded border border-amber-100 w-fit">
                      PAN Photo Not Uploaded
                    </span>
                  )}
                </div>

                <div className="bg-muted/30 border border-border p-3 rounded-lg flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground font-medium">
                      Driving Licence{" "}
                      {isEvOrNonMotorized(
                        kycRider.vehicle_type
                      )
                        ? "(Optional for EV / Cycle)"
                        : "*"}
                    </p>

                    <p className="text-xs font-bold text-foreground tracking-wide uppercase">
                      {kycRider.driving_license_number ||
                        "—"}
                    </p>
                  </div>

                  {kycRider.driving_license_document_url ? (
                    <div className="relative group w-full h-36 rounded-lg border border-border overflow-hidden bg-card">
                      <img
                        src={
                          kycRider.driving_license_document_url
                        }
                        alt="Driving License"
                        className="w-full h-full object-cover"
                      />

                      <a
                        href={
                          kycRider.driving_license_document_url
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-semibold gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Document
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-amber-600 italic bg-amber-50 px-2 py-1.5 rounded border border-amber-100 w-fit">
                      {isEvOrNonMotorized(
                        kycRider.vehicle_type
                      )
                        ? "DL Not Uploaded (Optional for EV / Cycle)"
                        : "DL Photo Not Uploaded"}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-muted/30 border border-border p-3 rounded-lg space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Bank & Payment Details
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs bg-card border border-border/60 p-2.5 rounded-md">
                  <div>
                    <span className="block text-[10px] uppercase text-muted-foreground font-semibold">
                      Bank Name
                    </span>

                    <span className="font-semibold text-foreground">
                      {kycRider.bank_name ||
                        "—"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase text-muted-foreground font-semibold">
                      Account Holder
                    </span>

                    <span className="font-semibold text-foreground">
                      {kycRider.account_holder_name ||
                        "—"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase text-muted-foreground font-semibold">
                      Account Number
                    </span>

                    <span className="font-semibold text-foreground">
                      {kycRider.account_number ||
                        "—"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase text-muted-foreground font-semibold">
                      IFSC Code
                    </span>

                    <span className="font-semibold text-foreground uppercase">
                      {kycRider.ifsc_code ||
                        "—"}
                    </span>
                  </div>

                  <div className="col-span-2 border-t border-border/60 pt-1.5 mt-0.5">
                    <span className="block text-[10px] uppercase text-muted-foreground font-semibold">
                      UPI ID
                    </span>

                    <span className="font-semibold text-foreground text-emerald-500">
                      {kycRider.upi_id ||
                        "—"}
                    </span>
                  </div>
                </div>

                {kycRider.qr_code_url && (
                  <div className="pt-2">
                    <span className="block text-[10px] uppercase text-muted-foreground font-semibold mb-1">
                      Rider Payment QR Code (Optional)
                    </span>

                    <div className="relative group w-28 h-28 rounded-lg border border-border overflow-hidden bg-card">
                      <img
                        src={
                          kycRider.qr_code_url
                        }
                        alt="QR Code"
                        className="w-full h-full object-cover"
                      />

                      <a
                        href={
                          kycRider.qr_code_url
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-semibold gap-1"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        View
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-muted/30 border border-border p-3 rounded-lg space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  KYC Document Status
                </p>

                {(() => {
                  const checks =
                    getKycChecklist(
                      kycRider
                    );

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        {checks.kycSelfie ? (
                          <CheckSquare className="w-4 h-4 text-[#22C55E]" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}

                        <span
                          className={
                            checks.kycSelfie
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          Selfie
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-medium">
                        {checks.aadhaar ? (
                          <CheckSquare className="w-4 h-4 text-[#22C55E]" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}

                        <span
                          className={
                            checks.aadhaar
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          Aadhaar (F & B)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-medium">
                        {checks.pan ? (
                          <CheckSquare className="w-4 h-4 text-[#22C55E]" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}

                        <span
                          className={
                            checks.pan
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          PAN Card
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-medium">
                        {checks.drivingLicense ? (
                          <CheckSquare className="w-4 h-4 text-[#22C55E]" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}

                        <span
                          className={
                            checks.drivingLicense
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          Driving Licence
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-medium">
                        {checks.bankDetails ? (
                          <CheckSquare className="w-4 h-4 text-[#22C55E]" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}

                        <span
                          className={
                            checks.bankDetails
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          Bank Details
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 border border-border p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    Verification Status
                  </p>

                  <Badge
                    variant={
                      kycBadgeMap[
                        kycRider.kyc_status
                      ]?.variant ||
                      "neutral"
                    }
                    label={
                      kycBadgeMap[
                        kycRider.kyc_status
                      ]?.label ||
                      "⚪ Not Submitted"
                    }
                  />
                </div>

                <div className="bg-muted/30 border border-border p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    Submitted Date
                  </p>

                  <p className="text-xs font-semibold text-foreground mt-1">
                    {kycRider.documents_updated_at
                      ? new Date(
                          kycRider.documents_updated_at
                        ).toLocaleString(
                          "en-GB"
                        )
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="bg-muted/30 border border-border p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1 font-medium">
                  Verification Notes
                </p>

                <p className="text-xs text-foreground bg-card p-2 rounded border border-border/50 min-h-[40px]">
                  {kycRider.verification_notes ||
                    "No verification ledger logs entered."}
                </p>
              </div>
            </div>
          </Modal>
        )}

      {rejectConfirmOpen && (
        <Modal
          open={
            rejectConfirmOpen
          }
          onClose={() =>
            setRejectConfirmOpen(
              false
            )
          }
          title="Reject KYC Verification"
          description="Select a reason or enter custom notes to notify the rider."
          size="sm"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button
                variant="secondary"
                onClick={() =>
                  setRejectConfirmOpen(
                    false
                  )
                }
                disabled={
                  isSubmitting
                }
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={
                  handleRejectKyc
                }
                disabled={
                  isSubmitting ||
                  !rejectReason.trim()
                }
              >
                {isSubmitting
                  ? "Rejecting..."
                  : "Confirm Rejection"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 pt-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                Quick Reasons
              </p>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_REJECT_REASONS.map(
                  (reason) => (
                    <button
                      key={
                        reason
                      }
                      type="button"
                      onClick={() =>
                        setRejectReason(
                          reason
                        )
                      }
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-md border transition-colors",

                        rejectReason ===
                          reason
                          ? "bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E]"
                          : "bg-muted border-border text-foreground hover:bg-muted/80"
                      )}
                    >
                      {
                        reason
                      }
                    </button>
                  )
                )}
              </div>
            </div>

            <Input
              label="Reason for Rejection *"
              placeholder="e.g. Unclear document photo, mismatch in bank details"
              value={
                rejectReason
              }
              onChange={(e) =>
                setRejectReason(
                  e.target.value
                )
              }
            />
          </div>
        </Modal>
      )}

      {viewRider &&
        assignmentOpen && (
          <Modal
            open={
              assignmentOpen
            }
            onClose={() => {
              setAssignmentOpen(
                false
              );
              setViewRider(
                null
              );
            }}
            title={`Link Stores: ${viewRider.name}`}
            description="Attach or remove linked storefront configurations for this driver."
            size="md"
            footer={
              <div className="flex gap-2 justify-end w-full">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAssignmentOpen(
                      false
                    );
                    setViewRider(
                      null
                    );
                  }}
                  disabled={
                    isSubmitting
                  }
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  onClick={
                    handleSaveQuickAssignment
                  }
                  disabled={
                    isSubmitting
                  }
                >
                  {isSubmitting
                    ? "Linking Channels..."
                    : "Apply Mapping"}
                </Button>
              </div>
            }
          >
            <div className="space-y-4 pt-2">
              <div className="bg-muted/40 p-3 rounded-lg border border-border flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-[#22C55E]" />

                <span>
                  Modifying links updates the assignment layout for admin records and vendor portals instantly.
                </span>
              </div>

              <div>
                <Select
                  label="Select Storefront to Attach"
                  value=""
                  onChange={
                    handleSelectVendor
                  }
                  options={
                    vendorOptions
                  }
                  placeholder="Click to attach a store..."
                />

                <div className="flex flex-wrap gap-1 mt-3 min-h-[80px] max-h-[150px] overflow-y-auto border border-border p-2 rounded-lg bg-muted/20">
                  {formVendors.length ===
                  0 ? (
                    <span className="text-xs text-muted-foreground italic m-auto">
                      No linked stores found (General Fleet).
                    </span>
                  ) : (
                    formVendors.map(
                      (v) => (
                        <span
                          key={
                            v.id
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-card text-xs font-semibold text-foreground border border-border shadow-sm animate-fade-in"
                        >
                          <Store className="w-3.5 h-3.5 text-[#22C55E]" />

                          <span>
                            {
                              v.name
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setFormVendors(
                                formVendors.filter(
                                  (
                                    item
                                  ) =>
                                    item.id !==
                                    v.id
                                )
                              )
                            }
                            className="text-muted-foreground hover:text-destructive font-bold ml-1 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          </Modal>
        )}

      <Modal
        open={addOpen}
        onClose={() =>
          setAddOpen(false)
        }
        title="Onboard Fleet Rider"
        description="Register a new delivery companion and assign them to one or more fulfillment shops."
        size="md"
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button
              variant="secondary"
              onClick={() =>
                setAddOpen(false)
              }
              disabled={
                isSubmitting
              }
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={
                handleAddRider
              }
              disabled={
                isSubmitting
              }
            >
              {isSubmitting
                ? "Registering..."
                : "Onboard Rider"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              placeholder="e.g. Ramesh Kumar"
              value={
                formName
              }
              onChange={(e) =>
                setFormName(
                  e.target.value
                )
              }
            />

            <Input
              label="Contact Phone *"
              placeholder="+91 98765 12345"
              value={
                formPhone
              }
              onChange={(e) =>
                setFormPhone(
                  e.target.value
                )
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Vehicle Segment Type *"
              value={
                formVehicleType
              }
              onChange={(
                val: string
              ) =>
                setFormVehicleType(
                  val as VehicleType
                )
              }
              options={[
                {
                  value:
                    "bike",
                  label:
                    "Motorcycle",
                },
                {
                  value:
                    "scooter",
                  label:
                    "Scooter",
                },
                {
                  value:
                    "electric_scooter",
                  label:
                    "EV Scooter",
                },
                {
                  value:
                    "bicycle",
                  label:
                    "Bicycle",
                },
              ]}
            />

            <Input
              label="Vehicle Registration No."
              placeholder="KA-01-EF-4321"
              value={
                formVehicleNumber
              }
              onChange={(e) =>
                setFormVehicleNumber(
                  e.target.value
                )
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              placeholder="ops@delivery.com"
              value={
                formEmail
              }
              onChange={(e) =>
                setFormEmail(
                  e.target.value
                )
              }
            />

            <Input
              label="Primary Operating Area *"
              placeholder="Koramangala, Bangalore"
              value={
                formLocation
              }
              onChange={(e) =>
                setFormLocation(
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <Select
              label="Assign to Stores / Shops (Supports Multiple)"
              value=""
              onChange={
                handleSelectVendor
              }
              options={
                vendorOptions
              }
              placeholder="Click to attach a store..."
            />

            {formVendors.length >
              0 && (
              <div className="flex flex-wrap gap-1 mt-2 max-h-[65px] overflow-y-auto border border-border p-1.5 rounded-lg bg-muted/40">
                {formVendors.map(
                  (v) => (
                    <span
                      key={
                        v.id
                      }
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-card text-xs font-semibold text-foreground border border-border shadow-sm"
                    >
                      {
                        v.name
                      }

                      <button
                        type="button"
                        onClick={() =>
                          setFormVendors(
                            formVendors.filter(
                              (
                                item
                              ) =>
                                item.id !==
                                v.id
                            )
                          )
                        }
                        className="text-muted-foreground hover:text-destructive font-bold ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {viewRider &&
        !editOpen &&
        !assignmentOpen && (
          <Modal
            open={
              !!viewRider
            }
            onClose={() =>
              setViewRider(
                null
              )
            }
            title={
              viewRider.name
            }
            description={`Rider Profile ID: ${viewRider.id}`}
            size="md"
            footer={
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="destructive"
                  leftIcon={
                    <Trash2 className="w-3.5 h-3.5" />
                  }
                  onClick={() =>
                    handleDeleteRider(
                      viewRider.id,
                      viewRider.name
                    )
                  }
                  disabled={
                    isSubmitting
                  }
                >
                  Remove Rider
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setViewRider(
                        null
                      )
                    }
                  >
                    Close
                  </Button>

                  <Button
                    variant="primary"
                    leftIcon={
                      <Edit className="w-3.5 h-3.5" />
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(
                        viewRider
                      );
                    }}
                  >
                    Edit Details
                  </Button>
                </div>
              </div>
            }
          >
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    label:
                      "Rider Name",
                    value:
                      viewRider.name,
                  },
                  {
                    label:
                      "Delivery Zone Area",
                    value:
                      viewRider.location_area,
                  },
                  {
                    label:
                      "Phone Connection",
                    value:
                      viewRider.phone,
                  },
                  {
                    label:
                      "Email Address",
                    value:
                      viewRider.email,
                  },
                  {
                    label:
                      "Vehicle Category Type",
                    value:
                      vehicleLabelMap[
                        viewRider.vehicle_type
                      ],
                  },
                  {
                    label:
                      "License Plate Details",
                    value:
                      viewRider.vehicle_number.toUpperCase(),
                  },
                  {
                    label:
                      "Registration Date",
                    value:
                      viewRider.joinedAt,
                  },
                ].map(
                  (item) => (
                    <div
                      key={
                        item.label
                      }
                      className="bg-muted/30 rounded-lg p-3 border border-border/50"
                    >
                      <p className="text-xs text-muted-foreground mb-1 font-medium">
                        {
                          item.label
                        }
                      </p>

                      <p className="text-sm font-semibold text-foreground">
                        {
                          item.value
                        }
                      </p>
                    </div>
                  )
                )}
              </div>

              <div className="bg-muted/30 border border-border p-3 rounded-lg space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Personal Information
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      label:
                        "Gender",
                      value:
                        viewRider.gender,
                    },
                    {
                      label:
                        "Blood Group",
                      value:
                        viewRider.blood_group,
                    },
                    {
                      label:
                        "Phone",
                      value:
                        viewRider.phone,
                    },
                    {
                      label:
                        "Email",
                      value:
                        viewRider.email,
                    },
                    {
                      label:
                        "Emergency Contact",
                      value:
                        viewRider.emergency_contact,
                    },
                    {
                      label:
                        "Alternate Contact",
                      value:
                        viewRider.alternate_contact,
                    },
                    {
                      label:
                        "Address",
                      value:
                        viewRider.address,
                    },
                    {
                      label:
                        "City",
                      value:
                        viewRider.city,
                    },
                    {
                      label:
                        "State",
                      value:
                        viewRider.state,
                    },
                    {
                      label:
                        "PIN Code",
                      value:
                        viewRider.pin_code,
                    },
                    {
                      label:
                        "Specially Abled",
                      value:
                        viewRider.is_specially_abled
                          ? "Yes"
                          : "No",
                    },

                    ...(viewRider.is_specially_abled &&
                    viewRider.disability_type
                      ? [
                          {
                            label:
                              "Disability Type",
                            value:
                              viewRider.disability_type,
                          },
                        ]
                      : []),
                  ].map(
                    (item) => (
                      <div
                        key={
                          item.label
                        }
                        className="bg-card rounded-md p-2.5 border border-border/50"
                      >
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">
                          {
                            item.label
                          }
                        </p>

                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {
                            item.value
                          }
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="bg-muted/30 border border-border p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                  Currently Attached Stores (
                  {
                    viewRider
                      .assigned_vendors
                      .length
                  }
                  )
                </p>

                <div className="flex flex-wrap gap-1">
                  {viewRider
                    .assigned_vendors
                    .length ===
                  0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      General Fleet unassigned pool
                    </span>
                  ) : (
                    viewRider.assigned_vendors.map(
                      (v) => (
                        <span
                          key={
                            v.id
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-card text-xs font-semibold text-foreground border border-border"
                        >
                          <Store className="w-3.5 h-3.5 text-[#22C55E]" />

                          {
                            v.name
                          }
                        </span>
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          </Modal>
        )}

      {viewRider &&
        editOpen && (
          <Modal
            open={editOpen}
            onClose={() =>
              setEditOpen(
                false
              )
            }
            title={`Edit ${viewRider.name}`}
            description="Update field records or modify systemic store alignment contexts."
            size="md"
            footer={
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="destructive"
                  leftIcon={
                    <Trash2 className="w-3.5 h-3.5" />
                  }
                  onClick={() =>
                    handleDeleteRider(
                      viewRider.id,
                      viewRider.name
                    )
                  }
                  disabled={
                    isSubmitting
                  }
                >
                  Delete Permanent
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setEditOpen(
                        false
                      )
                    }
                    disabled={
                      isSubmitting
                    }
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="primary"
                    onClick={
                      handleEditRider
                    }
                    disabled={
                      isSubmitting
                    }
                  >
                    {isSubmitting
                      ? "Saving..."
                      : "Save Changes"}
                  </Button>
                </div>
              </div>
            }
          >
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name *"
                  value={
                    formName
                  }
                  onChange={(e) =>
                    setFormName(
                      e.target.value
                    )
                  }
                />

                <Input
                  label="Primary Delivery Zone *"
                  value={
                    formLocation
                  }
                  onChange={(e) =>
                    setFormLocation(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Email"
                  value={
                    formEmail
                  }
                  onChange={(e) =>
                    setFormEmail(
                      e.target.value
                    )
                  }
                />

                <Input
                  label="Phone Number *"
                  value={
                    formPhone
                  }
                  onChange={(e) =>
                    setFormPhone(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Vehicle Segment Type"
                  value={
                    formVehicleType
                  }
                  onChange={(
                    val: string
                  ) =>
                    setFormVehicleType(
                      val as VehicleType
                    )
                  }
                  options={[
                    {
                      value:
                        "bike",
                      label:
                        "Motorcycle",
                    },
                    {
                      value:
                        "scooter",
                      label:
                        "Scooter",
                    },
                    {
                      value:
                        "electric_scooter",
                      label:
                        "EV Scooter",
                    },
                    {
                      value:
                        "bicycle",
                      label:
                        "Bicycle",
                    },
                  ]}
                />

                <Input
                  label="License Number Plate"
                  value={
                    formVehicleNumber
                  }
                  onChange={(e) =>
                    setFormVehicleNumber(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Select
                  label="Fulfillment Status Profile"
                  value={
                    formStatus
                  }
                  onChange={(
                    val: string
                  ) =>
                    setFormStatus(
                      val as RiderStatus
                    )
                  }
                  options={[
                    {
                      value:
                        "inactive",
                      label:
                        "Pending Approval",
                    },
                    {
                      value:
                        "active",
                      label:
                        "Active",
                    },
                    {
                      value:
                        "suspended",
                      label:
                        "Suspended",
                    },
                  ]}
                />
              </div>

              <div>
                <Select
                  label="Modify Attached Stores (Supports Multi-Shop Link)"
                  value=""
                  onChange={
                    handleSelectVendor
                  }
                  options={
                    vendorOptions
                  }
                  placeholder="Click to attach a store..."
                />

                <div className="flex flex-wrap gap-1 mt-2 max-h-[65px] overflow-y-auto border border-border p-1.5 rounded-lg bg-muted/40">
                  {formVendors.length ===
                  0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      No active shop parameters linked
                    </span>
                  ) : (
                    formVendors.map(
                      (v) => (
                        <span
                          key={
                            v.id
                          }
                          className="inline-flex items-center gap-1 py-0.5 px-2 rounded bg-card text-xs font-semibold text-foreground border border-border shadow-sm"
                        >
                          {
                            v.name
                          }

                          <button
                            type="button"
                            onClick={() =>
                              setFormVendors(
                                formVendors.filter(
                                  (
                                    item
                                  ) =>
                                    item.id !==
                                    v.id
                                )
                              )
                            }
                            className="text-muted-foreground hover:text-destructive font-bold ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          </Modal>
        )}
    </div>
  );
}