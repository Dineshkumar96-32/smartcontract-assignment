// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ZyncToken — ZYNC utility token for AureLexa (Zync)
/// @notice Public mint: send ETH at `mintPriceWei` per 1 full token (18 decimals).
///         Owner can treasury-mint, set price, and withdraw sale proceeds.
contract ZyncToken is ERC20, Ownable, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    /// Price in wei for 1e18 wei of tokens (one full ZYNC with 18 decimals).
    uint256 public mintPriceWei;

    error CapExceeded();
    error ZeroAmount();

    // Events
    event Burned(address indexed from, uint256 amount);

    event MintPriceUpdated(
        uint256 previousPrice,
        uint256 newPrice
    );

    event TreasuryMint(
        address indexed to,
        uint256 amount
    );

    event Withdrawn(
        address indexed owner,
        uint256 amount
    );

    constructor(uint256 initialMintPriceWei)
        ERC20("Zync", "ZYNC")
        Ownable(msg.sender)
    {
        mintPriceWei = initialMintPriceWei;
    }

    function setMintPrice(uint256 newPriceWei) external onlyOwner {
        if (newPriceWei == 0) revert ZeroAmount();

        uint256 previousPrice = mintPriceWei;
        mintPriceWei = newPriceWei;

        emit MintPriceUpdated(previousPrice, newPriceWei);
    }

    /// @notice Treasury / airdrops — does not require ETH; capped by MAX_SUPPLY.
    function mintTo(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) revert CapExceeded();

        _mint(to, amount);

        emit TreasuryMint(to, amount);
    }

    /// @notice Buy ZYNC with native currency on the same chain.
    function mintWithEth() external payable nonReentrant {
        if (mintPriceWei == 0) revert ZeroAmount();
        if (msg.value < mintPriceWei) revert ZeroAmount();

        uint256 wholeTokens = msg.value / mintPriceWei;
        uint256 tokenAmount = wholeTokens * 10 ** 18;

        if (tokenAmount == 0) revert ZeroAmount();
        if (totalSupply() + tokenAmount > MAX_SUPPLY) revert CapExceeded();

        uint256 costWei = wholeTokens * mintPriceWei;

        _mint(msg.sender, tokenAmount);

        uint256 refund = msg.value - costWei;
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "refund failed");
        }
    }

    /// @notice Burn your own tokens.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
        emit Burned(account, amount);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;

        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "withdraw failed");

        emit Withdrawn(owner(), amount);
    }

    receive() external payable {
        revert("use mintWithEth");
    }
}