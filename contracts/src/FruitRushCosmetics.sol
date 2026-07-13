// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*──────────────────────────────────────────────────────────────────────────────
 ███████╗██████╗ ██╗   ██╗██╗████████╗    ███████╗██╗      █████╗ ███████╗██╗  ██╗
 ██╔════╝██╔══██╗██║   ██║██║╚══██╔══╝    ██╔════╝██║     ██╔══██╗██╔════╝██║  ██║
 █████╗  ██████╔╝██║   ██║██║   ██║       ███████╗██║     ███████║███████╗███████║
 ██╔══╝  ██╔══██╗██║   ██║██║   ██║       ╚════██║██║     ██╔══██║╚════██║██╔══██║
 ██║     ██║  ██║╚██████╔╝██║   ██║       ███████║███████╗██║  ██║███████║██║  ██║
 ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝   ╚═╝       ╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝

 FruitRushCosmetics — ERC-1155 cosmetics for the Fruit Rush mobile arcade game.
 Deployed on Celo (EVM-compatible L2).

 Token-ID Schema
 ───────────────
 Bits [255..248]  Category  (8 bits):  1=KnifeSkin 2=FruitSkin 3=Trail 4=Background
 Bits [247..240]  Rarity    (8 bits):  1=Common 2=Rare 3=Epic 4=Legendary
 Bits [239..0]    Serial    (240 bits): sequential counter within category+rarity

 e.g. token ID 0x0102000000000001
      → Category 1 (KnifeSkin) | Rarity 2 (Rare) | Serial 1

 Roles
 ─────
 DEFAULT_ADMIN_ROLE  → owner / multisig
 MINTER_ROLE         → game backend hot wallet + shop contract
 UPGRADER_ROLE       → owner / multisig (kept separate for fine-grained control)

 Royalties
 ─────────
 5% ERC-2981 secondary-sale royalty paid to the royalty receiver set by owner.
──────────────────────────────────────────────────────────────────────────────*/

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title FruitRushCosmetics
/// @notice ERC-1155 cosmetics contract for Fruit Rush on Celo. Items are
///         directly minted by the game backend or shop contract on purchase.
///         Fully transferable (players may resell). 5% ERC-2981 royalty.
///         Upgradeable via UUPS proxy.
/// @custom:oz-upgrades-unsafe-allow constructor
contract FruitRushCosmetics is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    ERC1155URIStorageUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    // ═══════════════════════════════════════════════════════════════════════════
    //  ROLES
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public constant MINTER_ROLE   = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    //  TOKEN CATEGORY & RARITY CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public constant CATEGORY_KNIFE_SKIN  = 1;
    uint256 public constant CATEGORY_FRUIT_SKIN  = 2;
    uint256 public constant CATEGORY_TRAIL       = 3;
    uint256 public constant CATEGORY_BACKGROUND  = 4;

    uint256 public constant RARITY_COMMON    = 1;
    uint256 public constant RARITY_RARE      = 2;
    uint256 public constant RARITY_EPIC      = 3;
    uint256 public constant RARITY_LEGENDARY = 4;

    // Bit-shift positions within a token ID
    uint256 private constant _CATEGORY_SHIFT = 248; // bits [255..248]
    uint256 private constant _RARITY_SHIFT   = 240; // bits [247..240]

    // ═══════════════════════════════════════════════════════════════════════════
    //  ITEM REGISTRY
    // ═══════════════════════════════════════════════════════════════════════════

    struct ItemType {
        uint256 maxSupply;  // 0 means unlimited
        bool    exists;
    }

    /// @dev tokenId => ItemType definition
    mapping(uint256 => ItemType) public itemTypes;

    // ═══════════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted whenever a cosmetic is minted to a player.
    event CosmeticMinted(address indexed to, uint256 indexed tokenId, uint256 amount);

    /// @notice Emitted when a new item type is registered.
    event ItemTypeAdded(uint256 indexed tokenId, uint256 maxSupply, string tokenURI);

    /// @notice Emitted when the royalty receiver is updated.
    event RoyaltyReceiverUpdated(address indexed newReceiver);

    // ═══════════════════════════════════════════════════════════════════════════
    //  ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error UnknownItemType(uint256 tokenId);
    error SupplyCapExceeded(uint256 tokenId, uint256 requested, uint256 remaining);
    error ItemTypeAlreadyExists(uint256 tokenId);
    error InvalidTokenId();
    error ZeroAddress();
    error ZeroAmount();

    // ═══════════════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR — disables initializers on the implementation itself
    // ═══════════════════════════════════════════════════════════════════════════

    constructor() {
        _disableInitializers();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  INITIALIZER
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Initialise the proxy.
    /// @param defaultAdmin    Address that receives DEFAULT_ADMIN_ROLE (multisig).
    /// @param minter          Initial minter address (game backend hot wallet).
    /// @param royaltyReceiver Address that receives secondary-sale royalties.
    /// @param baseURI_        Base URI prefix; individual tokens may override via
    ///                        ERC1155URIStorage.
    function initialize(
        address defaultAdmin,
        address minter,
        address royaltyReceiver,
        string calldata baseURI_
    ) external initializer {
        if (defaultAdmin    == address(0)) revert ZeroAddress();
        if (minter          == address(0)) revert ZeroAddress();
        if (royaltyReceiver == address(0)) revert ZeroAddress();

        __ERC1155_init(baseURI_);
        __ERC1155Supply_init();
        __ERC1155URIStorage_init();
        __ERC2981_init();
        __AccessControl_init();
        // UUPSUpgradeable in OZ v5 has no __init function — it uses the implementation directly

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE,        minter);
        _grantRole(UPGRADER_ROLE,      defaultAdmin);

        // 5% royalty — 500 basis points out of 10_000
        _setDefaultRoyalty(royaltyReceiver, 500);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  ADMIN — ITEM TYPE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register a new cosmetic item type. Only callable by DEFAULT_ADMIN_ROLE.
    /// @param tokenId   The unique token ID (must encode category + rarity per schema).
    /// @param maxSupply Maximum mintable supply; pass 0 for unlimited.
    /// @param tokenURI_ Full metadata URI for this token (ipfs://... or https://...).
    function addItemType(
        uint256 tokenId,
        uint256 maxSupply,
        string calldata tokenURI_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (tokenId == 0)              revert InvalidTokenId();
        if (itemTypes[tokenId].exists) revert ItemTypeAlreadyExists(tokenId);
        _validateTokenId(tokenId);

        itemTypes[tokenId] = ItemType({ maxSupply: maxSupply, exists: true });
        _setURI(tokenId, tokenURI_);

        emit ItemTypeAdded(tokenId, maxSupply, tokenURI_);
    }

    /// @notice Update the metadata URI for a registered item type. Only callable by DEFAULT_ADMIN_ROLE.
    /// @param tokenId   The registered token ID.
    /// @param tokenURI_ New metadata URI.
    function setTokenURI(uint256 tokenId, string calldata tokenURI_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!itemTypes[tokenId].exists) revert UnknownItemType(tokenId);
        _setURI(tokenId, tokenURI_);
    }

    /// @notice Update the royalty receiver address. Keeps the 5% fraction.
    function setRoyaltyReceiver(address newReceiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newReceiver == address(0)) revert ZeroAddress();
        _setDefaultRoyalty(newReceiver, 500);
        emit RoyaltyReceiverUpdated(newReceiver);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  MINTING
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mint `amount` of `tokenId` to `to`. Callable only by MINTER_ROLE.
    /// @param to      Recipient (player's wallet).
    /// @param tokenId The cosmetic item to mint.
    /// @param amount  Number of copies (normally 1 for unique cosmetics).
    function mint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0)      revert ZeroAmount();

        ItemType storage item = itemTypes[tokenId];
        if (!item.exists)     revert UnknownItemType(tokenId);

        if (item.maxSupply != 0) {
            uint256 alreadyMinted = totalSupply(tokenId);
            if (alreadyMinted + amount > item.maxSupply) {
                revert SupplyCapExceeded(tokenId, amount, item.maxSupply - alreadyMinted);
            }
        }

        _mint(to, tokenId, amount, "");
        emit CosmeticMinted(to, tokenId, amount);
    }

    /// @notice Batch-mint multiple items in a single transaction.
    ///         Each (tokenId, amount) pair is validated independently.
    function mintBatch(
        address to,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        uint256 len = tokenIds.length;
        require(len == amounts.length, "length mismatch");

        for (uint256 i = 0; i < len; ++i) {
            uint256 tokenId = tokenIds[i];
            uint256 amount  = amounts[i];
            if (amount == 0) revert ZeroAmount();

            ItemType storage item = itemTypes[tokenId];
            if (!item.exists)     revert UnknownItemType(tokenId);

            if (item.maxSupply != 0) {
                uint256 alreadyMinted = totalSupply(tokenId);
                if (alreadyMinted + amount > item.maxSupply) {
                    revert SupplyCapExceeded(tokenId, amount, item.maxSupply - alreadyMinted);
                }
            }
        }

        _mintBatch(to, tokenIds, amounts, "");
        for (uint256 i = 0; i < len; ++i) {
            emit CosmeticMinted(to, tokenIds[i], amounts[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  URI RESOLUTION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Returns the metadata URI for `tokenId`.
    ///         Prefers per-token URI set via ERC1155URIStorage; falls back to
    ///         the base URI inherited from ERC1155.
    function uri(uint256 tokenId)
        public
        view
        override(ERC1155Upgradeable, ERC1155URIStorageUpgradeable)
        returns (string memory)
    {
        return ERC1155URIStorageUpgradeable.uri(tokenId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  HELPER — TOKEN-ID SCHEMA UTILITIES (view / pure)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Encode a token ID from its constituent parts.
    /// @param category  1–4 (see CATEGORY_* constants)
    /// @param rarity    1–4 (see RARITY_* constants)
    /// @param serial    Unique counter within category+rarity (starts at 1)
    function encodeTokenId(
        uint256 category,
        uint256 rarity,
        uint256 serial
    ) external pure returns (uint256) {
        require(category >= 1 && category <= 4, "bad category");
        require(rarity   >= 1 && rarity   <= 4, "bad rarity");
        require(serial   >= 1,                  "serial must be >= 1");
        return (category << _CATEGORY_SHIFT) | (rarity << _RARITY_SHIFT) | serial;
    }

    /// @notice Decode a token ID into its constituent parts.
    function decodeTokenId(uint256 tokenId)
        external
        pure
        returns (uint256 category, uint256 rarity, uint256 serial)
    {
        category = tokenId >> _CATEGORY_SHIFT;
        rarity   = (tokenId >> _RARITY_SHIFT) & 0xFF;
        serial   = tokenId & ((uint256(1) << _RARITY_SHIFT) - 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  INTERNAL
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Reverts if `tokenId` doesn't encode a valid category and rarity.
    function _validateTokenId(uint256 tokenId) internal pure {
        uint256 category = tokenId >> _CATEGORY_SHIFT;
        uint256 rarity   = (tokenId >> _RARITY_SHIFT) & 0xFF;
        uint256 serial   = tokenId & ((uint256(1) << _RARITY_SHIFT) - 1);
        if (category < 1 || category > 4) revert InvalidTokenId();
        if (rarity   < 1 || rarity   > 4) revert InvalidTokenId();
        if (serial   == 0)                revert InvalidTokenId();
    }

    /// @dev UUPS upgrade guard — only UPGRADER_ROLE may authorise an upgrade.
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    /// @dev Required by Solidity for diamond-inheritance resolution.
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) {
        super._update(from, to, ids, values);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  ERC-165 INTERFACE DETECTION
    // ═══════════════════════════════════════════════════════════════════════════

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
