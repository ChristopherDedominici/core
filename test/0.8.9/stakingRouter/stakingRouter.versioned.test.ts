import { expect } from "chai";
import { randomBytes } from "ethers";
import hre from "hardhat";

import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import type { HardhatEthers } from "@nomicfoundation/hardhat-ethers/types";

import type { StakingRouter } from "typechain-types/index.js";

import { randomAddress } from "lib/address.js";
import { MAX_UINT256 } from "lib/constants.js";
import { proxify } from "lib/proxy.js";

describe("StakingRouter.sol:Versioned", () => {
  let ethers: HardhatEthers;

  let deployer: HardhatEthersSigner;
  let admin: HardhatEthersSigner;

  let impl: StakingRouter;
  let versioned: StakingRouter;

  const petrifiedVersion = MAX_UINT256;

  before(async () => {
    ({ ethers } = await hre.network.getOrCreate());

    [deployer, admin] = await ethers.getSigners();

    // deploy staking router
    const depositContract = randomAddress();
    const allocLib = await ethers.deployContract("MinFirstAllocationStrategy", deployer);
    const stakingRouterFactory = await ethers.getContractFactory("StakingRouter", {
      libraries: {
        ["project/contracts/common/lib/MinFirstAllocationStrategy.sol:MinFirstAllocationStrategy"]:
          await allocLib.getAddress(),
      },
    });

    impl = await stakingRouterFactory.connect(deployer).deploy(depositContract);

    [versioned] = await proxify({ impl, admin });
  });

  context("constructor", () => {
    it("Petrifies the implementation", async () => {
      expect(await impl.getContractVersion()).to.equal(petrifiedVersion);
    });
  });

  context("getContractVersion", () => {
    it("Returns 0 as the initial contract version", async () => {
      expect(await versioned.getContractVersion()).to.equal(0n);
    });
  });

  context("initialize", () => {
    it("Increments version", async () => {
      await versioned.initialize(randomAddress(), randomAddress(), randomBytes(32));

      expect(await versioned.getContractVersion()).to.equal(3n);
    });
  });
});
