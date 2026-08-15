const API_BASE =
    window.BIKE_RENTAL_CONFIG.API_BASE_URL
        .replace(/\/$/, "");

const BIKE_API =
    `${API_BASE}/api/bikes`;

const BOOKING_API =
    `${API_BASE}/api/bookings`;

const ADMIN_USER_API =
    `${API_BASE}/api/admin/users`;

const AI_SPEC_API =
    `${API_BASE}/api/admin/bikes/specifications/generate`;

const MAX_IMAGE_BYTES =
    5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ]);

const ADMIN_TOKEN_KEY =
    "bikeRentalAdminToken";

let editId = null;

let editImageUrl = "";

let bikesCache = [];

let bookingsCache = [];

let usersCache = [];

let previewObjectUrl = null;

let generatedSpecsDraft = null;

let generatedSpecsSources = [];

let generatedSpecsModel = "";

let generatedSpecsIdentity = "";


// ---------------------------------------------------------
// ADMIN AUTH
// ---------------------------------------------------------

function adminToken() {

    return (
        localStorage.getItem(
            ADMIN_TOKEN_KEY
        ) || ""
    );
}


async function adminFetch(
    url,
    options = {}
) {

    const token =
        adminToken();

    const headers =
        new Headers(
            options.headers || {}
        );

    if (token) {

        headers.set(
            "Authorization",
            `Bearer ${token}`
        );
    }

    const response =
        await fetch(
            url,
            {
                ...options,
                headers
            }
        );

    if (
        response.status === 401 ||
        response.status === 403
    ) {

        localStorage.removeItem(
            ADMIN_TOKEN_KEY
        );

        window.location.href =
            "login.html";
    }

    return response;
}


// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function escapeHtml(
    value = ""
) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}


function imageSrc(
    imageUrl
) {

    if (!imageUrl) {
        return "";
    }

    if (
        /^https?:\/\//i.test(
            imageUrl
        )
    ) {

        return imageUrl;
    }

    return (
        `${API_BASE}/` +
        imageUrl.replace(
            /^\//,
            ""
        )
    );
}


async function errorMessage(
    res
) {

    try {

        const data =
            await res.json();

        return (
            data.message ||
            data.error ||
            `Request failed (${res.status})`
        );

    }
    catch {

        try {

            const text =
                await res.text();

            return (
                text ||
                `Request failed (${res.status})`
            );

        }
        catch {

            return (
                `Request failed (${res.status})`
            );
        }
    }
}


function showToast(
    message,
    type = "success"
) {

    const container =
        document.getElementById(
            "toastContainer"
        );

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast ${type}`;

    toast.textContent =
        message;

    container.appendChild(
        toast
    );

    requestAnimationFrame(
        () =>
            toast.classList.add(
                "show"
            )
    );

    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

            setTimeout(
                () =>
                    toast.remove(),
                250
            );

        },
        3200
    );
}


function setButtonLoading(
    button,
    loading,
    loadingText,
    normalText
) {

    button.disabled =
        loading;

    button.textContent =
        loading
            ? loadingText
            : normalText;

    button.classList.toggle(
        "is-loading",
        loading
    );
}


// ---------------------------------------------------------
// FIELD ERRORS
// ---------------------------------------------------------

function clearFieldError(
    id
) {

    const input =
        document.getElementById(
            id
        );

    const error =
        document.getElementById(
            `${id}Error`
        );

    if (input) {

        input.classList.remove(
            "input-error"
        );

        input.removeAttribute(
            "aria-invalid"
        );
    }

    if (error) {

        error.textContent = "";
    }
}


function setFieldError(
    id,
    message
) {

    const input =
        document.getElementById(
            id
        );

    const error =
        document.getElementById(
            `${id}Error`
        );

    if (input) {

        input.classList.add(
            "input-error"
        );

        input.setAttribute(
            "aria-invalid",
            "true"
        );
    }

    if (error) {

        error.textContent =
            message;
    }
}


// ---------------------------------------------------------
// BIKE FORM VALIDATION
// ---------------------------------------------------------

function validateBikeForm() {

    [
        "name",
        "type",
        "fuelType",
        "modelYear",
        "price",
        "hourlyPrice",
        "image"
    ].forEach(
        clearFieldError
    );

    const name =
        document
            .getElementById(
                "name"
            )
            .value
            .trim()
            .replace(
                /\s+/g,
                " "
            );

    const type =
        document
            .getElementById(
                "type"
            )
            .value
            .trim()
            .replace(
                /\s+/g,
                " "
            );

    const fuelType =
        document
            .getElementById(
                "fuelType"
            )
            .value
            .trim()
            .toUpperCase();


    const modelYear =
        Number(
            document
                .getElementById(
                    "modelYear"
                )
                .value
        );


    const price =
        Number(
            document
                .getElementById(
                    "price"
                )
                .value
        );

    const hourlyPrice =
        Number(
            document
                .getElementById(
                    "hourlyPrice"
                )
                .value
        );

    const file =
        document
            .getElementById(
                "image"
            )
            .files[0];

    let firstInvalid =
        null;


    // NAME

    if (
        name.length < 2
    ) {

        setFieldError(
            "name",
            "Vehicle name must be at least 2 characters."
        );

        firstInvalid ??=
            "name";

    }
    else if (
        name.length > 80
    ) {

        setFieldError(
            "name",
            "Vehicle name must be 80 characters or fewer."
        );

        firstInvalid ??=
            "name";
    }


    // TYPE

    if (!type) {

        setFieldError(
            "type",
            "Vehicle type is required."
        );

        firstInvalid ??=
            "type";

    }
    else if (
        type.length > 30
    ) {

        setFieldError(
            "type",
            "Vehicle type must be 30 characters or fewer."
        );

        firstInvalid ??=
            "type";
    }


    // FUEL TYPE

    if (
        !["PETROL", "ELECTRIC"]
            .includes(
                fuelType
            )
    ) {

        setFieldError(
            "fuelType",
            "Choose Petrol or Electric."
        );

        firstInvalid ??=
            "fuelType";
    }


    // MODEL YEAR

    if (
        !Number.isInteger(
            modelYear
        ) ||
        modelYear < 1950 ||
        modelYear > 2100
    ) {

        setFieldError(
            "modelYear",
            "Enter a valid model year between 1950 and 2100."
        );

        firstInvalid ??=
            "modelYear";
    }


    // DAILY PRICE

    if (
        !Number.isFinite(
            price
        ) ||
        price <= 0
    ) {

        setFieldError(
            "price",
            "Enter a daily price greater than ₹0."
        );

        firstInvalid ??=
            "price";

    }
    else if (
        price > 1000000
    ) {

        setFieldError(
            "price",
            "Maximum daily price is ₹10,00,000."
        );

        firstInvalid ??=
            "price";
    }


    // HOURLY PRICE

    if (
        !Number.isFinite(
            hourlyPrice
        ) ||
        hourlyPrice <= 0
    ) {

        setFieldError(
            "hourlyPrice",
            "Enter an hourly price greater than ₹0."
        );

        firstInvalid ??=
            "hourlyPrice";

    }
    else if (
        hourlyPrice > 1000000
    ) {

        setFieldError(
            "hourlyPrice",
            "Maximum hourly price is ₹10,00,000."
        );

        firstInvalid ??=
            "hourlyPrice";

    }
    else if (
        Number.isFinite(
            price
        ) &&
        price > 0 &&
        hourlyPrice > price
    ) {

        setFieldError(
            "hourlyPrice",
            "Hourly price cannot be greater than the daily price."
        );

        firstInvalid ??=
            "hourlyPrice";
    }


    // IMAGE

    if (file) {

        if (
            !ALLOWED_IMAGE_TYPES.has(
                file.type
            )
        ) {

            setFieldError(
                "image",
                "Choose a JPG, PNG, WEBP or GIF image."
            );

            firstInvalid ??=
                "image";

        }
        else if (
            file.size >
            MAX_IMAGE_BYTES
        ) {

            setFieldError(
                "image",
                "Image must be 5 MB or smaller."
            );

            firstInvalid ??=
                "image";
        }
    }


    if (firstInvalid) {

        document
            .getElementById(
                firstInvalid
            )
            .focus();

        return null;
    }


    return {

        name,

        type,

        fuelType,

        modelYear,

        price,

        hourlyPrice,

        file
    };
}



// ---------------------------------------------------------
// AI VEHICLE SPECIFICATIONS
// ---------------------------------------------------------

const AI_SPEC_FIELDS = [
    ["displacementCc", "Displacement", value => `${value} cc`],
    ["engineType", "Engine Type", value => value],
    ["maxPower", "Max Power", value => value],
    ["maxTorque", "Max Torque", value => value],
    ["transmission", "Transmission", value => value],
    ["topSpeedKmph", "Top Speed", value => `${value} km/h`],
    ["mileageKmpl", "Mileage", value => `${value} km/l`],
    ["fuelTankLitres", "Fuel Tank", value => `${value} L`],
    ["batteryCapacityKwh", "Battery", value => `${value} kWh`],
    ["claimedRangeKm", "Claimed Range", value => `${value} km`],
    ["chargingTime", "Charging Time", value => value],
    ["motorPower", "Motor Power", value => value],
    ["frontBrake", "Front Brake", value => value],
    ["rearBrake", "Rear Brake", value => value],
    ["absType", "ABS", value => value],
    ["frontTyre", "Front Tyre", value => value],
    ["rearTyre", "Rear Tyre", value => value],
    ["wheelType", "Wheels", value => value],
    ["frontSuspension", "Front Suspension", value => value],
    ["rearSuspension", "Rear Suspension", value => value],
    ["kerbWeightKg", "Kerb Weight", value => `${value} kg`],
    ["seatHeightMm", "Seat Height", value => `${value} mm`],
    ["groundClearanceMm", "Ground Clearance", value => `${value} mm`],
    ["cylinders", "Cylinders", value => String(value)],
    ["coolingSystem", "Cooling", value => value],
    ["clutchType", "Clutch", value => value],
    ["startingType", "Starting", value => value]
];

function currentAiSpecIdentity() {

    const name =
        document
            .getElementById(
                "name"
            )
            ?.value
            .trim()
            .replace(
                /\s+/g,
                " "
            ) || "";

    const modelYear =
        document
            .getElementById(
                "modelYear"
            )
            ?.value || "";

    const type =
        document
            .getElementById(
                "type"
            )
            ?.value
            .trim()
            .replace(
                /\s+/g,
                " "
            ) || "";

    const fuelType =
        document
            .getElementById(
                "fuelType"
            )
            ?.value
            .trim()
            .toUpperCase() || "";

    return [
        name.toLowerCase(),
        modelYear,
        type.toLowerCase(),
        fuelType
    ].join("|");
}

function hasSpecificationValue(
    value
) {

    return (
        value !== null &&
        value !== undefined &&
        value !== ""
    );
}

function hasAnyAiSpecification(
    specs
) {

    return !!specs &&
        AI_SPEC_FIELDS.some(
            ([key]) =>
                hasSpecificationValue(
                    specs[key]
                )
        );
}

function bikeSpecifications(
    bike
) {

    const specs = {};

    AI_SPEC_FIELDS.forEach(
        ([key]) => {

            if (
                hasSpecificationValue(
                    bike?.[key]
                )
            ) {

                specs[key] =
                    bike[key];
            }
        }
    );

    return specs;
}

function clearAiSpecificationPreview(
    {
        stale = false
    } = {}
) {

    generatedSpecsDraft =
        null;

    generatedSpecsSources =
        [];

    generatedSpecsModel =
        "";

    generatedSpecsIdentity =
        "";

    const preview =
        document.getElementById(
            "aiSpecPreview"
        );

    if (preview) {
        preview.hidden =
            true;
    }

    const status =
        document.getElementById(
            "aiSpecStatus"
        );

    if (status) {

        status.className =
            stale
                ? "ai-spec-status ai-spec-stale"
                : "ai-spec-status";

        status.textContent =
            stale
                ? "Vehicle identity changed. Generate AI specifications again."
                : "Ready when vehicle identity is filled.";
    }
}

function markAiSpecificationsStale() {

    if (
        generatedSpecsDraft
    ) {

        clearAiSpecificationPreview(
            {
                stale: true
            }
        );
    }
}

function formatAiSpecValue(
    key,
    value
) {

    const field =
        AI_SPEC_FIELDS.find(
            ([candidate]) =>
                candidate === key
        );

    if (!field) {
        return String(
            value
        );
    }

    return field[2](
        value
    );
}

function renderAiSpecifications(
    specs,
    {
        sources = [],
        model = "",
        notice = "",
        statusText = "Specifications ready. Review them, then save the vehicle."
    } = {}
) {

    generatedSpecsDraft =
        specs || {};

    generatedSpecsSources =
        Array.isArray(
            sources
        )
            ? sources
            : [];

    generatedSpecsModel =
        model || "";

    generatedSpecsIdentity =
        currentAiSpecIdentity();

    const preview =
        document.getElementById(
            "aiSpecPreview"
        );

    const summary =
        document.getElementById(
            "aiSpecSummary"
        );

    const list =
        document.getElementById(
            "aiSpecList"
        );

    const status =
        document.getElementById(
            "aiSpecStatus"
        );

    const noticeNode =
        document.getElementById(
            "aiSpecNotice"
        );

    const summaryKeys =
        [
            "displacementCc",
            "maxPower",
            "topSpeedKmph",
            document
                .getElementById(
                    "fuelType"
                )
                ?.value === "ELECTRIC"
                ? "claimedRangeKm"
                : "mileageKmpl"
        ];

    const summaryHtml =
        summaryKeys
            .filter(
                key =>
                    hasSpecificationValue(
                        generatedSpecsDraft[
                            key
                        ]
                    )
            )
            .map(
                key => {

                    const field =
                        AI_SPEC_FIELDS.find(
                            ([candidate]) =>
                                candidate === key
                        );

                    return `
                        <div>
                            <span>${escapeHtml(
                                field?.[1] || key
                            )}</span>
                            <strong>${escapeHtml(
                                formatAiSpecValue(
                                    key,
                                    generatedSpecsDraft[
                                        key
                                    ]
                                )
                            )}</strong>
                        </div>
                    `;
                }
            )
            .join("");

    summary.innerHTML =
        summaryHtml ||
        `
            <div>
                <span>AI Result</span>
                <strong>Verified details found</strong>
            </div>
        `;

    list.innerHTML =
        AI_SPEC_FIELDS
            .filter(
                ([key]) =>
                    hasSpecificationValue(
                        generatedSpecsDraft[
                            key
                        ]
                    )
            )
            .map(
                ([
                    key,
                    label
                ]) =>
                    `
                        <div>
                            <span>${escapeHtml(
                                label
                            )}</span>
                            <strong>${escapeHtml(
                                formatAiSpecValue(
                                    key,
                                    generatedSpecsDraft[
                                        key
                                    ]
                                )
                            )}</strong>
                        </div>
                    `
            )
            .join("");

    const sourceBlock =
        document.getElementById(
            "aiSpecSources"
        );

    const sourceLinks =
        document.getElementById(
            "aiSpecSourceLinks"
        );

    const safeSources =
        generatedSpecsSources.filter(
            source =>
                /^https?:\/\//i.test(
                    String(
                        source?.url || ""
                    )
                )
        );

    sourceBlock.hidden =
        safeSources.length === 0;

    sourceLinks.innerHTML =
        safeSources
            .map(
                source =>
                    `
                        <a
                            href="${escapeHtml(
                                source.url
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                            title="${escapeHtml(
                                source.title ||
                                "Specification source"
                            )}"
                        >
                            ${escapeHtml(
                                source.title ||
                                "Source"
                            )}
                        </a>
                    `
            )
            .join("");

    noticeNode.textContent =
        notice ||
        "Unknown or unsupported values are intentionally left blank.";

    status.className =
        "ai-spec-status is-success";

    status.textContent =
        statusText;

    preview.hidden =
        false;
}

async function generateAiSpecifications() {

    [
        "name",
        "type",
        "fuelType",
        "modelYear"
    ].forEach(
        clearFieldError
    );

    const name =
        document
            .getElementById(
                "name"
            )
            .value
            .trim()
            .replace(
                /\s+/g,
                " "
            );

    const type =
        document
            .getElementById(
                "type"
            )
            .value
            .trim()
            .replace(
                /\s+/g,
                " "
            );

    const fuelType =
        document
            .getElementById(
                "fuelType"
            )
            .value
            .trim()
            .toUpperCase();

    const modelYear =
        Number(
            document
                .getElementById(
                    "modelYear"
                )
                .value
        );

    let firstInvalid =
        null;

    if (
        name.length < 2
    ) {

        setFieldError(
            "name",
            "Enter the exact vehicle/model name."
        );

        firstInvalid ??=
            "name";
    }

    if (!type) {

        setFieldError(
            "type",
            "Vehicle type is required."
        );

        firstInvalid ??=
            "type";
    }

    if (
        !["PETROL", "ELECTRIC"]
            .includes(
                fuelType
            )
    ) {

        setFieldError(
            "fuelType",
            "Choose Petrol or Electric."
        );

        firstInvalid ??=
            "fuelType";
    }

    if (
        !Number.isInteger(
            modelYear
        ) ||
        modelYear < 1950 ||
        modelYear > 2100
    ) {

        setFieldError(
            "modelYear",
            "Enter the vehicle model year."
        );

        firstInvalid ??=
            "modelYear";
    }

    if (firstInvalid) {

        document
            .getElementById(
                firstInvalid
            )
            .focus();

        return;
    }

    const button =
        document.getElementById(
            "generateAiSpecsButton"
        );

    const status =
        document.getElementById(
            "aiSpecStatus"
        );

    setButtonLoading(
        button,
        true,
        "✨ Researching…",
        "✨ Generate AI Specs"
    );

    status.className =
        "ai-spec-status";

    status.textContent =
        "Gemini is checking public web sources and preparing the specification preview…";

    try {

        const response =
            await adminFetch(
                AI_SPEC_API,
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            {
                                name,
                                modelYear,
                                type,
                                fuelType
                            }
                        )
                }
            );

        if (!response.ok) {

            throw new Error(
                await errorMessage(
                    response
                )
            );
        }

        const result =
            await response.json();

        const specs =
            result?.specifications ||
            {};

        if (
            !hasAnyAiSpecification(
                specs
            )
        ) {

            throw new Error(
                "AI could not verify enough technical specifications for this exact vehicle."
            );
        }

        renderAiSpecifications(
            specs,
            {
                sources:
                    result.sources ||
                    [],

                model:
                    result.modelUsed ||
                    "",

                notice:
                    result.notice ||
                    ""
            }
        );

        showToast(
            "AI specifications generated. Review and save the vehicle."
        );

    }
    catch (error) {

        console.error(
            error
        );

        generatedSpecsDraft =
            null;

        generatedSpecsIdentity =
            "";

        status.className =
            "ai-spec-status is-error";

        status.textContent =
            error.message;

        document
            .getElementById(
                "aiSpecPreview"
            )
            .hidden =
                true;

        showToast(
            error.message,
            "error"
        );

    }
    finally {

        setButtonLoading(
            button,
            false,
            "✨ Researching…",
            "✨ Generate AI Specs"
        );
    }
}

function currentSpecificationPayload() {

    if (
        !generatedSpecsDraft ||
        generatedSpecsIdentity !==
            currentAiSpecIdentity()
    ) {

        return {};
    }

    const payload = {};

    AI_SPEC_FIELDS.forEach(
        ([key]) => {

            if (
                hasSpecificationValue(
                    generatedSpecsDraft[
                        key
                    ]
                )
            ) {

                payload[key] =
                    generatedSpecsDraft[
                        key
                    ];
            }
            else {

                payload[key] =
                    null;
            }
        }
    );

    payload.specificationsModel =
        generatedSpecsModel ||
        null;

    return payload;
}


// ---------------------------------------------------------
// STATS
// ---------------------------------------------------------

function updateStats() {

    const available =
        bikesCache.filter(
            bike =>
                bike.available
        ).length;

    const pending =
        bookingsCache.filter(
            booking =>
                booking.status ===
                "PENDING"
        ).length;

    document
        .getElementById(
            "totalBikeCount"
        )
        .textContent =
            bikesCache.length;

    document
        .getElementById(
            "availableBikeCount"
        )
        .textContent =
            available;

    document
        .getElementById(
            "unavailableBikeCount"
        )
        .textContent =
            bikesCache.length -
            available;

    document
        .getElementById(
            "pendingBookingCount"
        )
        .textContent =
            pending;


    const badge =
        document.getElementById(
            "pendingBookingBadge"
        );

    badge.textContent =
        pending;

    badge.hidden =
        pending === 0;


    const registeredUserCount =
        document.getElementById(
            "registeredUserCount"
        );

    if (registeredUserCount) {
        registeredUserCount.textContent =
            usersCache.length;
    }


    const totalUserBadge =
        document.getElementById(
            "totalUserBadge"
        );

    if (totalUserBadge) {
        totalUserBadge.textContent =
            usersCache.length;

        totalUserBadge.hidden =
            usersCache.length === 0;
    }
}


// ---------------------------------------------------------
// BIKE LIST
// ---------------------------------------------------------

function renderBikes() {

    const table =
        document.getElementById(
            "bikeTable"
        );

    const query =
        document
            .getElementById(
                "bikeSearch"
            )
            .value
            .trim()
            .toLowerCase();

    const filter =
        document
            .getElementById(
                "availabilityFilter"
            )
            .value;


    const filtered =
        bikesCache.filter(
            bike => {

                const matchesSearch =
                    !query ||

                    [
                        bike.id,
                        bike.name,
                        bike.type,
                        bike.fuelType
                    ]
                        .some(
                            value =>
                                String(
                                    value ?? ""
                                )
                                    .toLowerCase()
                                    .includes(
                                        query
                                    )
                        );


                const matchesStatus =

                    filter ===
                    "ALL"

                    ||

                    (
                        filter ===
                        "AVAILABLE" &&
                        bike.available
                    )

                    ||

                    (
                        filter ===
                        "UNAVAILABLE" &&
                        !bike.available
                    );


                return (
                    matchesSearch &&
                    matchesStatus
                );
            }
        );


    table.innerHTML = "";


    if (
        !filtered.length
    ) {

        table.innerHTML =
            `
            <tr>
                <td
                    class="empty-row"
                    colspan="9"
                >
                    No vehicles match this filter.
                </td>
            </tr>
            `;

        return;
    }


    filtered.forEach(
        bike => {

            const row =
                document.createElement(
                    "tr"
                );


            const hourlyText =
                bike.pricePerHour == null

                    ? `<span class="no-image">
                           Not set
                       </span>`

                    : `₹${Number(
                        bike.pricePerHour
                    ).toFixed(2)}`;


            row.innerHTML =
                `
                <td>
                    <span class="id-chip">
                        #${bike.id}
                    </span>
                </td>

                <td>
                    <strong>
                        ${escapeHtml(
                            bike.name
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        bike.type
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        bike.fuelType
                            ? bike.fuelType.charAt(0).toUpperCase() +
                              bike.fuelType.slice(1).toLowerCase()
                            : "Not set"
                    )}
                </td>

                <td>
                    ${hourlyText}
                </td>

                <td>
                    ₹${Number(
                        bike.pricePerDay
                    ).toFixed(2)}
                </td>

                <td>

                    <span
                        class="
                            status-pill
                            ${
                                bike.available
                                    ? "available"
                                    : "unavailable"
                            }
                        "
                    >
                        ${
                            bike.available
                                ? "Available"
                                : "Unavailable"
                        }
                    </span>

                </td>

                <td>

                    ${
                        bike.imageUrl

                        ?

                        `
                        <img
                            class="table-bike-image"
                            src="${
                                escapeHtml(
                                    imageSrc(
                                        bike.imageUrl
                                    )
                                )
                            }"
                            alt="${
                                escapeHtml(
                                    bike.name
                                )
                            }"
                        >
                        `

                        :

                        `
                        <span class="no-image">
                            No image
                        </span>
                        `
                    }

                </td>

                <td class="action-cell">

                    <button
                        class="table-btn"
                        type="button"
                        onclick="
                            editBike(
                                ${bike.id}
                            )
                        "
                    >
                        Edit
                    </button>

                    <button
                        class="
                            table-btn
                            danger
                        "
                        type="button"
                        onclick="
                            deleteBike(
                                ${bike.id}
                            )
                        "
                    >
                        Delete
                    </button>

                    ${
                        bike.available

                        ?

                        `
                        <button
                            class="
                                table-btn
                                danger-soft
                            "
                            type="button"
                            onclick="
                                makeUnavailable(
                                    ${bike.id}
                                )
                            "
                        >
                            Make Unavailable
                        </button>
                        `

                        :

                        `
                        <button
                            class="
                                table-btn
                                warning
                            "
                            type="button"
                            onclick="
                                makeAvailable(
                                    ${bike.id}
                                )
                            "
                        >
                            Make Available
                        </button>
                        `
                    }

                </td>
                `;


            table.appendChild(
                row
            );
        }
    );
}


// ---------------------------------------------------------
// LOAD BIKES
// ---------------------------------------------------------

async function loadBikes() {

    const table =
        document.getElementById(
            "bikeTable"
        );

    table.innerHTML =
        `
        <tr>
            <td
                class="empty-row"
                colspan="8"
            >
                Loading vehicles…
            </td>
        </tr>
        `;


    try {

        const res =
            await adminFetch(
                BIKE_API,
                {
                    cache:
                        "no-store"
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        bikesCache =
            await res.json();


        renderBikes();

        updateStats();

    }
    catch (error) {

        console.error(
            error
        );


        table.innerHTML =
            `
            <tr>
                <td
                    class="
                        empty-row
                        error-text
                    "
                    colspan="8"
                >
                    Backend unavailable:
                    ${
                        escapeHtml(
                            error.message
                        )
                    }
                </td>
            </tr>
            `;
    }
}


// ---------------------------------------------------------
// SAVE BIKE
// ---------------------------------------------------------

async function saveBike(
    event
) {

    event.preventDefault();


    const values =
        validateBikeForm();


    if (!values) {
        return;
    }


    const button =
        document.getElementById(
            "saveBikeButton"
        );


    const normalText =
        editId
            ? "Update Bike"
            : "Save Bike";


    setButtonLoading(
        button,
        true,
        editId
            ? "Updating…"
            : "Saving…",
        normalText
    );


    try {

        let imageUrl =
            editImageUrl;


        // IMAGE UPLOAD

        if (values.file) {

            const formData =
                new FormData();


            formData.append(
                "file",
                values.file
            );


            const uploadRes =
                await adminFetch(
                    `${BIKE_API}/upload`,
                    {
                        method:
                            "POST",

                        body:
                            formData
                    }
                );


            if (!uploadRes.ok) {

                throw new Error(
                    await errorMessage(
                        uploadRes
                    )
                );
            }


            imageUrl =
                `uploads/${
                    await uploadRes.text()
                }`;
        }


        // BACKEND-EXPECTED BIKE DATA

        const bikeData = {

            name:
                values.name,

            type:
                values.type,

            fuelType:
                values.fuelType,

            modelYear:
                values.modelYear,

            pricePerDay:
                values.price,

            pricePerHour:
                values.hourlyPrice,

            imageUrl,

            ...currentSpecificationPayload()
        };


        const url =
            editId
                ? `${BIKE_API}/${editId}`
                : BIKE_API;


        const method =
            editId
                ? "PUT"
                : "POST";


        const res =
            await adminFetch(
                url,
                {

                    method,

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            bikeData
                        )
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        showToast(
            editId

                ? "Vehicle updated successfully."

                : "Vehicle added successfully."
        );


        resetBikeForm();

        await loadBikes();

    }
    catch (error) {

        console.error(
            error
        );

        showToast(
            error.message,
            "error"
        );

    }
    finally {

        setButtonLoading(
            button,
            false,
            editId
                ? "Updating…"
                : "Saving…",
            editId
                ? "Update Bike"
                : "Save Bike"
        );
    }
}


// ---------------------------------------------------------
// EDIT BIKE
// ---------------------------------------------------------

function editBike(
    id
) {

    const bike =
        bikesCache.find(
            item =>
                item.id === id
        );


    if (!bike) {
        return;
    }


    [
        "name",
        "type",
        "fuelType",
        "modelYear",
        "price",
        "hourlyPrice",
        "image"
    ].forEach(
        clearFieldError
    );


    document
        .getElementById(
            "name"
        )
        .value =
            bike.name;


    document
        .getElementById(
            "type"
        )
        .value =
            bike.type;


    document
        .getElementById(
            "fuelType"
        )
        .value =
            bike.fuelType
                ? String(
                      bike.fuelType
                  ).toUpperCase()
                : "";


    document
        .getElementById(
            "modelYear"
        )
        .value =
            bike.modelYear ?? "";


    document
        .getElementById(
            "price"
        )
        .value =
            bike.pricePerDay;


    document
        .getElementById(
            "hourlyPrice"
        )
        .value =
            bike.pricePerHour ?? "";


    document
        .getElementById(
            "image"
        )
        .value =
            "";


    editId =
        bike.id;


    editImageUrl =
        bike.imageUrl || "";


    document
        .getElementById(
            "formTitle"
        )
        .textContent =
            `Edit Bike #${bike.id}`;


    document
        .getElementById(
            "saveBikeButton"
        )
        .textContent =
            "Update Bike";


    document
        .getElementById(
            "cancelEditButton"
        )
        .hidden =
            false;


    if (bike.imageUrl) {

        showImagePreview(
            imageSrc(
                bike.imageUrl
            ),
            `Current image for ${bike.name}`
        );

    }
    else {

        hideImagePreview();
    }


    const savedSpecs =
        bikeSpecifications(
            bike
        );

    if (
        hasAnyAiSpecification(
            savedSpecs
        )
    ) {

        renderAiSpecifications(
            savedSpecs,
            {
                model:
                    bike.specificationsModel ||
                    "",

                notice:
                    "These specifications are already saved for this vehicle. Regenerate them if the model identity changed.",

                statusText:
                    "Saved technical specifications loaded."
            }
        );

    }
    else {

        clearAiSpecificationPreview();
    }


    window.scrollTo(
        {
            top: 0,
            behavior: "smooth"
        }
    );


    setTimeout(
        () =>
            document
                .getElementById(
                    "name"
                )
                .focus(),
        250
    );
}


// ---------------------------------------------------------
// RESET / CANCEL
// ---------------------------------------------------------

function cancelEdit() {

    resetBikeForm();
}


function resetBikeForm() {

    editId = null;

    editImageUrl = "";


    document
        .getElementById(
            "bikeForm"
        )
        .reset();


    document
        .getElementById(
            "formTitle"
        )
        .textContent =
            "Add Bike";


    document
        .getElementById(
            "saveBikeButton"
        )
        .textContent =
            "Save Bike";


    document
        .getElementById(
            "cancelEditButton"
        )
        .hidden =
            true;


    [
        "name",
        "type",
        "fuelType",
        "modelYear",
        "price",
        "hourlyPrice",
        "image"
    ].forEach(
        clearFieldError
    );


    hideImagePreview();

    clearAiSpecificationPreview();
}


// ---------------------------------------------------------
// IMAGE PREVIEW
// ---------------------------------------------------------

function showImagePreview(
    src,
    text
) {

    const wrap =
        document.getElementById(
            "imagePreviewWrap"
        );


    document
        .getElementById(
            "imagePreview"
        )
        .src =
            src;


    document
        .getElementById(
            "imagePreviewText"
        )
        .textContent =
            text;


    wrap.hidden =
        false;
}


function hideImagePreview() {

    if (previewObjectUrl) {

        URL.revokeObjectURL(
            previewObjectUrl
        );

        previewObjectUrl =
            null;
    }


    const wrap =
        document.getElementById(
            "imagePreviewWrap"
        );


    wrap.hidden =
        true;


    document
        .getElementById(
            "imagePreview"
        )
        .removeAttribute(
            "src"
        );


    document
        .getElementById(
            "imagePreviewText"
        )
        .textContent =
            "";
}


function handleImageChange(
    event
) {

    clearFieldError(
        "image"
    );


    const file =
        event.target.files[0];


    if (!file) {

        if (editImageUrl) {

            showImagePreview(
                imageSrc(
                    editImageUrl
                ),
                "Current vehicle image"
            );

        }
        else {

            hideImagePreview();
        }

        return;
    }


    if (
        !ALLOWED_IMAGE_TYPES.has(
            file.type
        )
    ) {

        setFieldError(
            "image",
            "Choose a JPG, PNG, WEBP or GIF image."
        );


        event.target.value =
            "";


        hideImagePreview();

        return;
    }


    if (
        file.size >
        MAX_IMAGE_BYTES
    ) {

        setFieldError(
            "image",
            "Image must be 5 MB or smaller."
        );


        event.target.value =
            "";


        hideImagePreview();

        return;
    }


    if (previewObjectUrl) {

        URL.revokeObjectURL(
            previewObjectUrl
        );
    }


    previewObjectUrl =
        URL.createObjectURL(
            file
        );


    showImagePreview(
        previewObjectUrl,
        `${file.name} • ${
            (
                file.size /
                1024 /
                1024
            ).toFixed(2)
        } MB`
    );
}


// ---------------------------------------------------------
// DELETE BIKE
// ---------------------------------------------------------

async function deleteBike(
    id
) {

    const bike =
        bikesCache.find(
            item =>
                item.id === id
        );


    if (
        !confirm(
            `Delete ${
                bike?.name ||
                `bike #${id}`
            }? This cannot be undone.`
        )
    ) {

        return;
    }


    try {

        const res =
            await adminFetch(
                `${BIKE_API}/${id}`,
                {
                    method:
                        "DELETE"
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        showToast(
            "Vehicle deleted."
        );


        if (
            editId === id
        ) {

            resetBikeForm();
        }


        await loadBikes();

    }
    catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// ---------------------------------------------------------
// BIKE OPERATIONAL AVAILABILITY
// ---------------------------------------------------------

async function makeAvailable(
    id
) {

    if (
        !confirm(
            "Make this vehicle operationally available?"
        )
    ) {

        return;
    }


    try {

        const res =
            await adminFetch(
                `${BIKE_API}/${id}/available`,
                {
                    method:
                        "PUT"
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        showToast(
            "Vehicle is operationally available."
        );


        await Promise.all([
            loadBikes(),
            loadBookings()
        ]);

    }
    catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


async function makeUnavailable(
    id
) {

    if (
        !confirm(
            "Mark this vehicle unavailable? Existing booking records will remain unchanged."
        )
    ) {

        return;
    }


    try {

        const res =
            await adminFetch(
                `${BIKE_API}/${id}/unavailable`,
                {
                    method:
                        "PUT"
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        showToast(
            "Vehicle marked unavailable."
        );


        await loadBikes();

    }
    catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// ---------------------------------------------------------
// BOOKINGS
// ---------------------------------------------------------

function bookingStatusClass(
    status
) {

    return String(
        status || ""
    ).toLowerCase();
}


function bookingRentalText(
    booking
) {

    const rentalType =
        String(
            booking.rentalType ||
            "DAILY"
        ).toUpperCase();


    if (
        rentalType ===
        "HOURLY"
    ) {

        const hours =
            booking.durationHours ??
            0;

        return (
            `${hours} ` +
            (
                hours === 1
                    ? "hour"
                    : "hours"
            )
        );
    }


    const days =
        booking.durationDays ??
        1;


    return (
        `${days} ` +
        (
            days === 1
                ? "day"
                : "days"
        )
    );
}


function bookingPickupText(
    booking
) {

    const date =
        booking.date || "—";


    const rentalType =
        String(
            booking.rentalType ||
            "DAILY"
        ).toUpperCase();


    if (
        rentalType ===
        "HOURLY" &&
        booking.pickupTime
    ) {

        return (
            `${date}` +
            `<br>` +
            `<small>` +
            `${escapeHtml(
                booking.pickupTime
            )}` +
            `</small>`
        );
    }


    return escapeHtml(
        date
    );
}


function renderBookings() {

    const table =
        document.getElementById(
            "bookingTable"
        );


    const query =
        document
            .getElementById(
                "bookingSearch"
            )
            .value
            .trim()
            .toLowerCase();


    const filter =
        document
            .getElementById(
                "bookingStatusFilter"
            )
            .value;


    const filtered =
        bookingsCache.filter(
            booking => {

                const matchesSearch =

                    !query ||

                    [
                        booking.id,
                        booking.customerName,
                        booking.phone,
                        booking.bikeName
                    ]
                        .some(
                            value =>
                                String(
                                    value ?? ""
                                )
                                    .toLowerCase()
                                    .includes(
                                        query
                                    )
                        );


                const matchesStatus =

                    filter ===
                    "ALL"

                    ||

                    booking.status ===
                    filter;


                return (
                    matchesSearch &&
                    matchesStatus
                );
            }
        );


    table.innerHTML =
        "";


    if (
        !filtered.length
    ) {

        table.innerHTML =
            `
            <tr>
                <td
                    class="empty-row"
                    colspan="9"
                >
                    No bookings match this filter.
                </td>
            </tr>
            `;

        return;
    }


    filtered.forEach(
        booking => {

            let actions =
                "—";


            if (
                booking.status ===
                "PENDING"
            ) {

                actions =
                    `
                    <div class="booking-actions">

                        <button
                            class="
                                table-btn
                                success
                            "
                            type="button"
                            onclick="
                                approveBooking(
                                    ${booking.id}
                                )
                            "
                        >
                            Approve
                        </button>

                        <button
                            class="
                                table-btn
                                danger
                            "
                            type="button"
                            onclick="
                                rejectBooking(
                                    ${booking.id}
                                )
                            "
                        >
                            Reject
                        </button>

                    </div>
                    `;
            }


            const rentalType =
                String(
                    booking.rentalType ||
                    "DAILY"
                ).toUpperCase();


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML =
                `
                <td>

                    <span class="id-chip">
                        #${booking.id}
                    </span>

                </td>

                <td>

                    <strong>
                        ${
                            escapeHtml(
                                booking.customerName
                            )
                        }
                    </strong>

                </td>

                <td>
                    ${
                        escapeHtml(
                            booking.phone
                        )
                    }
                </td>

                <td>
                    ${
                        escapeHtml(
                            booking.bikeName
                        )
                    }
                </td>

                <td>
                    ${
                        bookingPickupText(
                            booking
                        )
                    }
                </td>

                <td>

                    <strong>
                        ${
                            escapeHtml(
                                rentalType
                            )
                        }
                    </strong>

                    <br>

                    <small>
                        ${
                            escapeHtml(
                                bookingRentalText(
                                    booking
                                )
                            )
                        }
                    </small>

                </td>

                <td>

                    ₹${
                        Number(
                            booking.totalAmount ||
                            0
                        ).toFixed(2)
                    }

                </td>

                <td>

                    <span
                        class="
                            booking-status
                            ${
                                bookingStatusClass(
                                    booking.status
                                )
                            }
                        "
                    >
                        ${
                            escapeHtml(
                                booking.status
                            )
                        }
                    </span>

                </td>

                <td>
                    ${actions}
                </td>
                `;


            table.appendChild(
                row
            );
        }
    );
}


// ---------------------------------------------------------
// REGISTERED USERS
// ---------------------------------------------------------

function userInitials(
    fullName
) {

    const parts =
        String(
            fullName || "User"
        )
            .trim()
            .split(
                /\s+/
            )
            .filter(
                Boolean
            );


    if (
        parts.length === 0
    ) {
        return "U";
    }


    if (
        parts.length === 1
    ) {
        return parts[0]
            .slice(0, 1)
            .toUpperCase();
    }


    return (
        parts[0]
            .slice(0, 1)
        +
        parts[
            parts.length - 1
        ]
            .slice(0, 1)
    )
        .toUpperCase();
}


function formatUserJoinedDate(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(
            value
        );
    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    )
        .format(
            date
        );
}


function renderUsers() {

    const table =
        document.getElementById(
            "userTable"
        );

    if (!table) {
        return;
    }


    const query =
        document
            .getElementById(
                "userSearch"
            )
            ?.value
            .trim()
            .toLowerCase()
        || "";


    const verificationFilter =
        document
            .getElementById(
                "userVerificationFilter"
            )
            ?.value
        || "ALL";


    const accountFilter =
        document
            .getElementById(
                "userAccountFilter"
            )
            ?.value
        || "ALL";


    const filtered =
        usersCache.filter(
            user => {

                const matchesSearch =
                    !query
                    ||
                    [
                        user.id,
                        user.fullName,
                        user.email,
                        user.phone
                    ]
                        .some(
                            value =>
                                String(
                                    value ?? ""
                                )
                                    .toLowerCase()
                                    .includes(
                                        query
                                    )
                        );


                const matchesVerification =
                    verificationFilter === "ALL"
                    ||
                    (
                        verificationFilter === "VERIFIED"
                        &&
                        user.emailVerified
                    )
                    ||
                    (
                        verificationFilter === "UNVERIFIED"
                        &&
                        !user.emailVerified
                    );


                const matchesAccount =
                    accountFilter === "ALL"
                    ||
                    (
                        accountFilter === "ACTIVE"
                        &&
                        user.active
                    )
                    ||
                    (
                        accountFilter === "INACTIVE"
                        &&
                        !user.active
                    );


                return (
                    matchesSearch
                    &&
                    matchesVerification
                    &&
                    matchesAccount
                );
            }
        );


    const verified =
        usersCache.filter(
            user =>
                user.emailVerified
        ).length;


    const visibleUserCount =
        document.getElementById(
            "visibleUserCount"
        );

    const verifiedUserCount =
        document.getElementById(
            "verifiedUserCount"
        );

    const unverifiedUserCount =
        document.getElementById(
            "unverifiedUserCount"
        );


    if (visibleUserCount) {
        visibleUserCount.textContent =
            filtered.length;
    }

    if (verifiedUserCount) {
        verifiedUserCount.textContent =
            verified;
    }

    if (unverifiedUserCount) {
        unverifiedUserCount.textContent =
            usersCache.length -
            verified;
    }


    if (
        filtered.length === 0
    ) {

        table.innerHTML =
            `
            <tr>
                <td
                    class="empty-row"
                    colspan="8"
                >
                    No registered users match
                    the current search/filter.
                </td>
            </tr>
            `;

        return;
    }


    table.innerHTML = "";


    filtered.forEach(
        user => {

            const row =
                document.createElement(
                    "tr"
                );


            const name =
                String(
                    user.fullName ||
                    "Unnamed User"
                );


            const initials =
                userInitials(
                    name
                );


            const verificationClass =
                user.emailVerified
                    ? "verified"
                    : "unverified";


            const verificationLabel =
                user.emailVerified
                    ? "Verified"
                    : "Not verified";


            const accountClass =
                user.active
                    ? "active"
                    : "inactive";


            const accountLabel =
                user.active
                    ? "Active"
                    : "Inactive";


            row.innerHTML =
                `
                <td>
                    #${escapeHtml(
                        user.id ?? "—"
                    )}
                </td>

                <td>
                    <div class="admin-user-cell">
                        <span class="admin-user-avatar">
                            ${escapeHtml(
                                initials
                            )}
                        </span>

                        <div>
                            <strong>
                                ${escapeHtml(
                                    name
                                )}
                            </strong>

                            <small>
                                Customer account
                            </small>
                        </div>
                    </div>
                </td>

                <td>
                    <span class="user-email">
                        ${escapeHtml(
                            user.email ||
                            "—"
                        )}
                    </span>
                </td>

                <td>
                    <span class="user-phone">
                        ${escapeHtml(
                            user.phone ||
                            "—"
                        )}
                    </span>
                </td>

                <td>
                    <span
                        class="
                            user-status-pill
                            ${verificationClass}
                        "
                    >
                        <span
                            class="user-status-dot"
                        ></span>

                        ${verificationLabel}
                    </span>
                </td>

                <td>
                    <span
                        class="
                            user-status-pill
                            ${accountClass}
                        "
                    >
                        <span
                            class="user-status-dot"
                        ></span>

                        ${accountLabel}
                    </span>
                </td>

                <td>
                    <span class="user-booking-count">
                        ${escapeHtml(
                            user.totalBookings ??
                            0
                        )}
                    </span>
                </td>

                <td>
                    <span class="user-joined-date">
                        ${escapeHtml(
                            formatUserJoinedDate(
                                user.createdAt
                            )
                        )}
                    </span>
                </td>
                `;


            table.appendChild(
                row
            );
        }
    );
}


async function loadUsers() {

    const table =
        document.getElementById(
            "userTable"
        );


    if (table) {

        table.innerHTML =
            `
            <tr>
                <td
                    class="empty-row"
                    colspan="8"
                >
                    Loading registered users…
                </td>
            </tr>
            `;
    }


    try {

        const res =
            await adminFetch(
                ADMIN_USER_API,
                {
                    cache:
                        "no-store"
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        const data =
            await res.json();


        usersCache =
            Array.isArray(
                data
            )
                ? data
                : [];


        renderUsers();

        updateStats();

    }
    catch (error) {

        console.error(
            error
        );


        if (table) {

            table.innerHTML =
                `
                <tr>
                    <td
                        class="
                            empty-row
                            error-text
                        "
                        colspan="8"
                    >
                        ${escapeHtml(
                            error.message
                        )}
                    </td>
                </tr>
                `;
        }


        showToast(
            `Users: ${error.message}`,
            "error"
        );
    }
}


function syncAdminPanelBodyLock() {

    const bookingOpen =
        document
            .getElementById(
                "bookingPanel"
            )
            ?.classList
            .contains(
                "active"
            )
        || false;


    const userOpen =
        document
            .getElementById(
                "userPanel"
            )
            ?.classList
            .contains(
                "active"
            )
        || false;


    document.body.classList.toggle(
        "panel-open",
        bookingOpen ||
        userOpen
    );
}


function toggleUserPanel(
    forceOpen
) {

    const panel =
        document.getElementById(
            "userPanel"
        );

    const backdrop =
        document.getElementById(
            "userPanelBackdrop"
        );


    if (
        !panel ||
        !backdrop
    ) {
        return;
    }


    const shouldOpen =
        typeof forceOpen ===
            "boolean"
            ? forceOpen
            : !panel.classList.contains(
                "active"
            );


    if (shouldOpen) {

        toggleBookingPanel(
            false
        );
    }


    panel.classList.toggle(
        "active",
        shouldOpen
    );


    backdrop.classList.toggle(
        "active",
        shouldOpen
    );


    panel.setAttribute(
        "aria-hidden",
        String(
            !shouldOpen
        )
    );


    syncAdminPanelBodyLock();


    if (shouldOpen) {

        loadUsers();

        setTimeout(
            () =>
                document
                    .getElementById(
                        "userSearch"
                    )
                    ?.focus(),
            150
        );
    }
}


// ---------------------------------------------------------
// LOAD BOOKINGS
// ---------------------------------------------------------

async function loadBookings() {

    const table =
        document.getElementById(
            "bookingTable"
        );


    table.innerHTML =
        `
        <tr>

            <td
                class="empty-row"
                colspan="9"
            >
                Loading bookings…
            </td>

        </tr>
        `;


    try {

        const res =
            await adminFetch(
                BOOKING_API,
                {
                    cache:
                        "no-store"
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        bookingsCache =
            await res.json();


        renderBookings();

        updateStats();

    }
    catch (error) {

        console.error(
            error
        );


        table.innerHTML =
            `
            <tr>

                <td
                    class="
                        empty-row
                        error-text
                    "
                    colspan="9"
                >
                    ${
                        escapeHtml(
                            error.message
                        )
                    }
                </td>

            </tr>
            `;
    }
}


// ---------------------------------------------------------
// BOOKING PANEL
// ---------------------------------------------------------

function toggleBookingPanel(
    forceOpen
) {

    const panel =
        document.getElementById(
            "bookingPanel"
        );

    const backdrop =
        document.getElementById(
            "panelBackdrop"
        );


    const shouldOpen =

        typeof forceOpen ===
        "boolean"

            ? forceOpen

            : !panel.classList.contains(
                "active"
            );


    if (shouldOpen) {

        const userPanel =
            document.getElementById(
                "userPanel"
            );

        const userBackdrop =
            document.getElementById(
                "userPanelBackdrop"
            );


        userPanel
            ?.classList
            .remove(
                "active"
            );

        userBackdrop
            ?.classList
            .remove(
                "active"
            );

        userPanel
            ?.setAttribute(
                "aria-hidden",
                "true"
            );
    }


    panel.classList.toggle(
        "active",
        shouldOpen
    );


    backdrop.classList.toggle(
        "active",
        shouldOpen
    );


    panel.setAttribute(
        "aria-hidden",
        String(
            !shouldOpen
        )
    );


    syncAdminPanelBodyLock();


    if (shouldOpen) {

        loadBookings();
    }
}


// ---------------------------------------------------------
// APPROVE BOOKING
// ---------------------------------------------------------

async function approveBooking(
    id
) {

    if (
        !confirm(
            `Approve booking #${id}?`
        )
    ) {

        return;
    }


    try {

        const res =
            await adminFetch(
                `${BOOKING_API}/${id}/approve`,
                {
                    method:
                        "PUT"
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        showToast(
            `Booking #${id} approved.`
        );


        await Promise.all([
            loadBookings(),
            loadBikes()
        ]);

    }
    catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// ---------------------------------------------------------
// REJECT BOOKING
// ---------------------------------------------------------

async function rejectBooking(
    id
) {

    if (
        !confirm(
            `Reject booking #${id}?`
        )
    ) {

        return;
    }


    try {

        const res =
            await adminFetch(
                `${BOOKING_API}/${id}/reject`,
                {
                    method:
                        "PUT"
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        showToast(
            `Booking #${id} rejected.`,
            "info"
        );


        await Promise.all([
            loadBookings(),
            loadBikes()
        ]);

    }
    catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// ---------------------------------------------------------
// CLEAR BOOKINGS
// ---------------------------------------------------------

async function clearBookings() {

    if (
        !confirm(
            "Delete ALL booking history? This cannot be undone."
        )
    ) {

        return;
    }


    try {

        const res =
            await adminFetch(
                `${BOOKING_API}/clear`,
                {
                    method:
                        "DELETE"
                }
            );


        if (!res.ok) {

            throw new Error(
                await errorMessage(
                    res
                )
            );
        }


        showToast(
            "All bookings cleared.",
            "info"
        );


        await Promise.all([
            loadBookings(),
            loadBikes()
        ]);

    }
    catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// ---------------------------------------------------------
// REFRESH
// ---------------------------------------------------------

async function refreshAdminData() {

    const button =
        document.getElementById(
            "refreshAdminButton"
        );


    setButtonLoading(
        button,
        true,
        "Refreshing…",
        "↻ Refresh"
    );


    await Promise.all([
        loadBikes(),
        loadBookings(),
        loadUsers()
    ]);


    setButtonLoading(
        button,
        false,
        "Refreshing…",
        "↻ Refresh"
    );
}


// ---------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------

function logout() {

    localStorage.removeItem(
        ADMIN_TOKEN_KEY
    );

    window.location.href =
        "login.html";
}


// ---------------------------------------------------------
// EVENT LISTENERS
// ---------------------------------------------------------

document
    .getElementById(
        "bikeForm"
    )
    .addEventListener(
        "submit",
        saveBike
    );


document
    .getElementById(
        "image"
    )
    .addEventListener(
        "change",
        handleImageChange
    );


document
    .getElementById(
        "bikeSearch"
    )
    .addEventListener(
        "input",
        renderBikes
    );


document
    .getElementById(
        "availabilityFilter"
    )
    .addEventListener(
        "change",
        renderBikes
    );


document
    .getElementById(
        "bookingSearch"
    )
    .addEventListener(
        "input",
        renderBookings
    );


document
    .getElementById(
        "bookingStatusFilter"
    )
    .addEventListener(
        "change",
        renderBookings
    );


document
    .getElementById(
        "userSearch"
    )
    ?.addEventListener(
        "input",
        renderUsers
    );


document
    .getElementById(
        "userVerificationFilter"
    )
    ?.addEventListener(
        "change",
        renderUsers
    );


document
    .getElementById(
        "userAccountFilter"
    )
    ?.addEventListener(
        "change",
        renderUsers
    );


[
    "name",
    "type",
    "modelYear",
    "price",
    "hourlyPrice"
].forEach(
    id => {

        document
            .getElementById(
                id
            )
            .addEventListener(
                "input",
                () =>
                    clearFieldError(
                        id
                    )
            );
    }
);



document
    .getElementById(
        "generateAiSpecsButton"
    )
    ?.addEventListener(
        "click",
        generateAiSpecifications
    );


[
    "name",
    "type",
    "modelYear"
].forEach(
    id => {

        document
            .getElementById(
                id
            )
            ?.addEventListener(
                "input",
                markAiSpecificationsStale
            );
    }
);


document
    .getElementById(
        "fuelType"
    )
    ?.addEventListener(
        "change",
        () => {

            clearFieldError(
                "fuelType"
            );

            markAiSpecificationsStale();
        }
    );


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Escape"
        ) {
            return;
        }


        if (
            document
                .getElementById(
                    "bookingPanel"
                )
                ?.classList
                .contains(
                    "active"
                )
        ) {

            toggleBookingPanel(
                false
            );
        }


        if (
            document
                .getElementById(
                    "userPanel"
                )
                ?.classList
                .contains(
                    "active"
                )
        ) {

            toggleUserPanel(
                false
            );
        }
    }
);


// ---------------------------------------------------------
// INITIAL LOAD
// ---------------------------------------------------------

Promise.all([
    loadBikes(),
    loadBookings(),
    loadUsers()
]);