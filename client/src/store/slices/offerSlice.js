import { createSlice } from "@reduxjs/toolkit";
import { offerApi } from "../../api/offer.api.js";
import { userApi } from "../../api/user.api.js";

const initialState = {
  offers: [],
  currentOffer: null,
  offerStats: null,
  recipients: [],
  recipientsMeta: null,
  availableOffers: [],
  availableMeta: null,
  myOffers: [],
  customers: [],
  customersMeta: null,
  meta: null,
  isLoading: false,
  isSubmitting: false,
  customersLoading: false,
  error: null,
};

const offerSlice = createSlice({
  name: "offer",
  initialState,
  reducers: {
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setSubmitting(state, action) {
      state.isSubmitting = action.payload;
    },
    setCustomersLoading(state, action) {
      state.customersLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    setOffers(state, action) {
      state.offers = action.payload.offers;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setCurrentOffer(state, action) {
      state.currentOffer = action.payload;
      state.error = null;
    },
    setOfferStats(state, action) {
      state.offerStats = action.payload;
      state.error = null;
    },
    setRecipients(state, action) {
      state.recipients = action.payload.recipients;
      state.recipientsMeta = action.payload.meta;
      state.error = null;
    },
    setAvailableOffers(state, action) {
      state.availableOffers = action.payload.offers;
      state.availableMeta = action.payload.meta;
      state.error = null;
    },
    setMyOffers(state, action) {
      state.myOffers = action.payload.offers;
      state.meta = action.payload.meta;
      state.error = null;
    },
    setCustomers(state, action) {
      state.customers = action.payload.users;
      state.customersMeta = action.payload.meta;
      state.error = null;
    },
    clearCurrentOffer(state) {
      state.currentOffer = null;
      state.offerStats = null;
      state.recipients = [];
      state.recipientsMeta = null;
    },
  },
});

export const {
  setLoading,
  setSubmitting,
  setCustomersLoading,
  setError,
  setOffers,
  setCurrentOffer,
  setOfferStats,
  setRecipients,
  setAvailableOffers,
  setMyOffers,
  setCustomers,
  clearCurrentOffer,
} = offerSlice.actions;

export const fetchOffers = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.getAll(params);
    dispatch(
      setOffers({
        offers: response.data?.offers || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load offers.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchOfferById = (offerId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.getById(offerId);
    dispatch(setCurrentOffer(response.data?.offer || response.data));
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load offer.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchOfferStats = (offerId) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.getStats(offerId);
    dispatch(setOfferStats(response.data || response.data?.stats));
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load offer stats.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchOfferRecipients =
  (offerId, params = {}) =>
  async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await offerApi.getRecipients(offerId, params);
      dispatch(
        setRecipients({
          recipients: response.data?.recipients || [],
          meta: response.data?.meta || null,
        })
      );
      return response;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to load recipients.")
      );
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

export const createOffer = (data) => async (dispatch) => {
  dispatch(setSubmitting(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.create(data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to create offer.")
    );
    throw error;
  } finally {
    dispatch(setSubmitting(false));
  }
};

export const updateOffer = (offerId, data) => async (dispatch) => {
  dispatch(setSubmitting(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.update(offerId, data);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to update offer.")
    );
    throw error;
  } finally {
    dispatch(setSubmitting(false));
  }
};

export const deleteOffer = (offerId) => async (dispatch) => {
  dispatch(setSubmitting(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.remove(offerId);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to delete offer.")
    );
    throw error;
  } finally {
    dispatch(setSubmitting(false));
  }
};

export const toggleOfferActive = (offerId, isActive) => async (dispatch) => {
  dispatch(setSubmitting(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.toggleActive(offerId, { isActive });
    return response;
  } catch (error) {
    dispatch(
      setError(
        error.response?.data?.message || "Failed to update offer availability."
      )
    );
    throw error;
  } finally {
    dispatch(setSubmitting(false));
  }
};

export const fetchAvailableOffers = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.getAvailable(params);
    dispatch(
      setAvailableOffers({
        offers: response.data?.offers || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load offers.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchMyOffers = (params = {}) => async (dispatch) => {
  dispatch(setLoading(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.getMine(params);
    dispatch(
      setMyOffers({
        offers: response.data?.offers || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load your offers.")
    );
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const consumeOfferForBill = (data) => async (dispatch) => {
  dispatch(setSubmitting(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.consumeOffer(data);
    return response;
  } catch (error) {
    dispatch(
      setError(
        error.response?.data?.message || "Failed to apply the offer to the bill."
      )
    );
    throw error;
  } finally {
    dispatch(setSubmitting(false));
  }
};

export const claimOffer = (offerId) => async (dispatch) => {
  dispatch(setSubmitting(true));
  dispatch(setError(null));
  try {
    const response = await offerApi.claim(offerId);
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to claim offer.")
    );
    throw error;
  } finally {
    dispatch(setSubmitting(false));
  }
};

export const fetchOwnerCustomers = (params = {}) => async (dispatch) => {
  dispatch(setCustomersLoading(true));
  dispatch(setError(null));
  try {
    const response = await userApi.getOwnerCustomers(params);
    dispatch(
      setCustomers({
        users: response.data?.users || [],
        meta: response.data?.meta || null,
      })
    );
    return response;
  } catch (error) {
    dispatch(
      setError(error.response?.data?.message || "Failed to load customers.")
    );
    throw error;
  } finally {
    dispatch(setCustomersLoading(false));
  }
};

export default offerSlice.reducer;
