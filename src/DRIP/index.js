import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
/**
 * Base URL for the DripStream API
 * @constant {string}
 * @private
 */
const API_BASE_URL = "https://api.drip.re/api/v4";

/**
 * DripStreamSDK - Main class for interacting with the DripStream API
 */
class DripAPI {
  /**
   * Creates a new instance of the DripStream SDK
   * @param {Object} config - Configuration options
   * @param {string} config.API_KEY - API key for authentication
   * @param {string} config.REALMS - Realm identifier
   * @param {string} config.POINTS_ID - Points identifier
   * @throws {Error} If required configuration is missing
   */
  constructor(config = {}) {
    // SDK metadata
    this.name = "dripstream-sdk";
    this.version = "1.0.0";

    // Required configuration
    this.API_KEY = process.env.DRIP_APIKEY;
    this.REALMS = process.env.REALMS_ID;
    this.POINTS_ID = process.env.DRIP_POINTS_ID;

    // Validate required configuration
    if (!this.API_KEY) {
      throw new Error(
        "API_KEY is required in config or as environment variable"
      );
    }

    if (!this.REALMS) {
      throw new Error(
        "REALMS is required in config or as environment variable"
      );
    }

    if (!this.POINTS_ID) {
      throw new Error(
        "POINTS_ID is required in config or as environment variable"
      );
    }

    // Default headers for all requests
    this.headers = {
      Authorization: `Bearer ${this.API_KEY}`,
      "Content-Type": "application/json",
    };

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: this.headers,
      timeout: 10000, // 10 second timeout
    });
  }

  /**
   * Gets the balance for a specific user
   * @param {string} userId - The user ID to query
   * @returns {Promise<Object>} User balance information
   * @throws {Error} If the request fails
   */
  async getBalance(userId) {
    if (!userId) {
      throw new Error("userId is required");
    }

    try {
      const response = await this.client.get(
        `/realms/${this.REALMS}/members/${userId}`
      );

      return JSON.parse(response.data.balances[this.POINTS_ID]);
    } catch (error) {
      this._handleApiError(error, "Failed to get user balance");
    }
  }

  /**
   * Updates the balance for a specific user
   * @param {string} userId - The user ID to update
   * @param {number} amount - The amount to set (positive or negative)
   * @returns {Promise<Object>} Result of the update operation
   * @throws {Error} If the request fails
   */
  async updateBalance(userId, amount) {
    if (!userId) {
      throw new Error("userId is required");
    }

    if (typeof amount !== "number") {
      throw new Error("amount must be a number");
    }

    try {
      const response = await this.client.patch(
        `/realms/${this.REALMS}/members/${userId}/tokenBalance`,
        {
          realmPointId: this.POINTS_ID,
          tokens: amount,
        }
      );
      return {
        success: true,
        userId,
        data: response.data,
      };
    } catch (error) {
      return this._formatErrorResponse(error, userId);
    }
  }

  /**
   * Updates balances for multiple users in a single batch operation
   * @param {Array<{userId: string, amount: number}>} entries - Array of user updates
   * @returns {Promise<Array<Object>>} Results for each update operation
   * @throws {Error} If the input is invalid
   */
  async batchUpdateBalance(entries = []) {
    // Validate input
    console.log(entries[0].userId);
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("Invalid input: entries must be a non-empty array");
    }

    // Validate each entry
    entries.forEach((entry, index) => {
      if (!entry.userId || typeof entry.amount !== "number") {
        throw new Error(
          `Invalid entry at index ${index}: each entry must have userId and amount`
        );
      }
    });

    // Process all updates in parallel for efficiency
    const updatePromises = entries.map((entry) =>
      this.updateBalance(entry.userId, entry.amount)
    );

    // Wait for all operations to complete
    return Promise.all(updatePromises);
  }

  /**
   * Formats error responses in a consistent way
   * @param {Error} error - The error object
   * @param {string} userId - The user ID associated with the error
   * @returns {Object} Formatted error response
   * @private
   */
  _formatErrorResponse(error, userId) {
    return {
      success: false,
      userId,
      message: error.response?.data || error.message,
      status: error.response?.status || 500,
    };
  }

  /**
   * Handles API errors with consistent error handling
   * @param {Error} error - The error object
   * @param {string} defaultMessage - Default message if none available
   * @throws {Error} With formatted error information
   * @private
   */
  _handleApiError(error, defaultMessage = "API request failed") {
    const status = error.response?.status;
    const message =
      error.response?.data?.message || error.message || defaultMessage;

    const formattedError = new Error(
      `${message} (${status || "unknown status"})`
    );
    formattedError.originalError = error;
    formattedError.status = status;

    throw formattedError;
  }
}

export default DripAPI;
