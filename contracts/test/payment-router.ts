import { expect } from 'chai';
import { ethers } from 'hardhat';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

describe('PaymentRouter', function () {
  it('emits OrderPaid and transfers token amount', async function () {
    const [buyer, supplier] = await ethers.getSigners();

    const mockFactory = await ethers.getContractFactory('MockUSDT');
    const token = await mockFactory.deploy();
    await token.waitForDeployment();

    const routerFactory = await ethers.getContractFactory('PaymentRouter');
    const router = await routerFactory.deploy();
    await router.waitForDeployment();

    await token.transfer(supplier.address, 0n); // touch supplier account
    await token.approve(await router.getAddress(), 1_000_000n);

    const orderId = ethers.keccak256(ethers.toUtf8Bytes('ord_1'));
    const serviceId = ethers.keccak256(ethers.toUtf8Bytes('svc_1'));

    await expect(router.payForService(orderId, serviceId, supplier.address, await token.getAddress(), 1_000_000n))
      .to.emit(router, 'OrderPaid')
      .withArgs(orderId, serviceId, buyer.address, supplier.address, await token.getAddress(), 1_000_000n, anyValue);

    expect(await token.balanceOf(supplier.address)).to.equal(1_000_000n);
  });

  it('reverts on zero amount', async function () {
    const [, supplier] = await ethers.getSigners();
    const mockFactory = await ethers.getContractFactory('MockUSDT');
    const token = await mockFactory.deploy();
    await token.waitForDeployment();

    const routerFactory = await ethers.getContractFactory('PaymentRouter');
    const router = await routerFactory.deploy();
    await router.waitForDeployment();

    await expect(
      router.payForService(
        ethers.keccak256(ethers.toUtf8Bytes('ord_2')),
        ethers.keccak256(ethers.toUtf8Bytes('svc_2')),
        supplier.address,
        await token.getAddress(),
        0
      )
    ).to.be.revertedWithCustomError(router, 'ZeroAmount');
  });
});
