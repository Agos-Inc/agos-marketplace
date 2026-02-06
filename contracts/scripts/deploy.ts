import { ethers } from 'hardhat';

async function main() {
  const factory = await ethers.getContractFactory('PaymentRouter');
  const router = await factory.deploy();
  await router.waitForDeployment();

  console.log('PaymentRouter deployed:', await router.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
