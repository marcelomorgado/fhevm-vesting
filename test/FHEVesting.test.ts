import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import {
  ConfidentialWETH,
  ConfidentialWETH__factory,
  ERC20Mock,
  ERC20Mock__factory,
  FHEVesting,
  FHEVesting__factory,
} from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

describe("FHEVesting", function () {
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let vesting: FHEVesting;
  let weth: ERC20Mock;
  let cwWETH: ConfidentialWETH;

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    [, alice, bob] = await ethers.getSigners();

    const erc20Factory = (await ethers.getContractFactory("ERC20Mock")) as ERC20Mock__factory;
    weth = (await erc20Factory.deploy()) as ERC20Mock;

    const cwWETHFactory = (await ethers.getContractFactory("ConfidentialWETH")) as ConfidentialWETH__factory;
    cwWETH = (await cwWETHFactory.deploy(await weth.getAddress())) as ConfidentialWETH;

    const vestingFactory = (await ethers.getContractFactory("FHEVesting")) as FHEVesting__factory;

    const start = await time.latest();
    const duration = time.duration.days(30);
    vesting = (await vestingFactory.deploy(await cwWETH.getAddress(), alice.address, start, duration)) as FHEVesting;

    //
    // Top up the vesting contract with 1000 cwWETH
    //
    await weth.mint(alice.address, ethers.parseEther("1000"));
    await weth.connect(alice).approve(await cwWETH.getAddress(), ethers.MaxUint256);
    await cwWETH.connect(alice).wrap(ethers.parseEther("1000"));

    const amount = ethers.parseUnits("1000", 6);
    const eAmount = await fhevm
      .createEncryptedInput(await cwWETH.getAddress(), alice.address)
      .add64(amount)
      .encrypt();

    await cwWETH
      .connect(alice)
      ["transfer(address,bytes32,bytes)"](await vesting.getAddress(), eAmount.handles[0], eAmount.inputProof);
  });

  it("only beneficiary should read released amount", async function () {
    const eReleased = await vesting.released();
    const aliceDecryption = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      eReleased,
      await vesting.getAddress(),
      alice,
    );
    expect(aliceDecryption).to.eq(0);

    const bobDecryption = async () =>
      fhevm.userDecryptEuint(FhevmType.euint64, eReleased, await vesting.getAddress(), bob);

    await expect(bobDecryption()).to.be.rejected;
  });

  it("should vest", async function () {
    // given
    await time.increase(time.duration.days(15));

    const eBalanceBefore = await cwWETH.balanceOf(await alice.getAddress());
    const balanceBefore = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      eBalanceBefore,
      await cwWETH.getAddress(),
      alice,
    );
    expect(balanceBefore).to.eq(0);

    // when
    await vesting.connect(alice).release();

    // then
    const eBalanceAfter = await cwWETH.balanceOf(await alice.getAddress());
    const balanceAfter = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      eBalanceAfter,
      await cwWETH.getAddress(),
      alice,
    );
    expect(balanceAfter).to.be.closeTo(ethers.parseUnits("500", 6), ethers.parseUnits("1", 6));
  });
});
