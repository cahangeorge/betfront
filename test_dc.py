import math

def poisson_pmf(k, lam):
    return math.exp(-lam) * (lam**k) / math.factorial(k)

def fit_dc(targets, rho=-0.15):
    best_err = float('inf')
    best = (1.0, 1.0)
    grid_coarse = [x * 0.1 for x in range(1, 61)]
    for lh in grid_coarse:
        pmf_h = [poisson_pmf(i, lh) for i in range(13)]
        for la in grid_coarse:
            joint = [[0.0]*13 for _ in range(13)]
            for i in range(13):
                for j in range(13):
                    tau = 1.0
                    if i == j:
                        if i == 0:
                            tau = 1.0 + rho
                        elif i == 1:
                            tau = 1.0 - lh * la * rho
                    joint[i][j] = tau * pmf_h[i] * poisson_pmf(j, la)
            total = sum(sum(row) for row in joint)
            if total == 0:
                continue
            p_h = sum(joint[i][j] for i in range(13) for j in range(13) if i > j) / total
            p_d = sum(joint[i][i] for i in range(13)) / total
            p_a = sum(joint[i][j] for i in range(13) for j in range(13) if i < j) / total
            err = (p_h-targets['home'])**2 + (p_d-targets['draw'])**2 + (p_a-targets['away'])**2
            if err < best_err:
                best_err = err
                best = (lh, la)
    lh0, la0 = best
    grid_fine = []
    for dx in range(-5, 6):
        v = lh0 + dx * 0.02
        if v > 0.05:
            grid_fine.append(v)
    grid_fine2 = []
    for dx in range(-5, 6):
        v = la0 + dx * 0.02
        if v > 0.05:
            grid_fine2.append(v)
    for lh in grid_fine:
        pmf_h = [poisson_pmf(i, lh) for i in range(13)]
        for la in grid_fine2:
            joint = [[0.0]*13 for _ in range(13)]
            for i in range(13):
                for j in range(13):
                    tau = 1.0
                    if i == j:
                        if i == 0:
                            tau = 1.0 + rho
                        elif i == 1:
                            tau = 1.0 - lh * la * rho
                    joint[i][j] = tau * pmf_h[i] * poisson_pmf(j, la)
            total = sum(sum(row) for row in joint)
            if total == 0:
                continue
            p_h = sum(joint[i][j] for i in range(13) for j in range(13) if i > j) / total
            p_d = sum(joint[i][i] for i in range(13)) / total
            p_a = sum(joint[i][j] for i in range(13) for j in range(13) if i < j) / total
            err = (p_h-targets['home'])**2 + (p_d-targets['draw'])**2 + (p_a-targets['away'])**2
            if err < best_err:
                best_err = err
                best = (lh, la)
    return best, best_err

# test with match 3 best odds: home 3.1, draw 3.13, away 2.45
# wait, these are the BEST odds (highest). Let's normalize.
best = {'home': 3.1, 'draw': 4.04, 'away': 2.84}  # actually best draw might be 4.04 from betfair
imp = {o: 1.0/best[o] for o in best}
s = sum(imp.values())
targets = {o: imp[o]/s for o in best}
print("targets:", targets)

(best_lam, err) = fit_dc(targets)
print("best lambda:", best_lam, "error:", err)

# compute derived probs
lh, la = best_lam
pmf_h = [poisson_pmf(i, lh) for i in range(13)]
joint = [[0.0]*13 for _ in range(13)]
for i in range(13):
    for j in range(13):
        tau = 1.0
        if i == j:
            if i == 0:
                tau = 1.15
            elif i == 1:
                tau = 1.0 - lh*la*(-0.15)
        joint[i][j] = tau * pmf_h[i] * poisson_pmf(j, la)
total = sum(sum(row) for row in joint)
p_h = sum(joint[i][j] for i in range(13) for j in range(13) if i > j) / total
p_d = sum(joint[i][i] for i in range(13)) / total
p_a = sum(joint[i][j] for i in range(13) for j in range(13) if i < j) / total
p_u25 = sum(joint[i][j] for i in range(13) for j in range(13) if i+j <= 2) / total
p_h0 = sum(joint[0][j] for j in range(13)) / total
p_a0 = sum(joint[i][0] for i in range(13)) / total
p_btts_yes = 1.0 - p_h0 - p_a0 + joint[0][0]/total
print("probs:", p_h, p_d, p_a, 1-p_u25, p_btts_yes)

# test timing
import time
start = time.time()
for _ in range(32):
    fit_dc(targets)
print("time for 32 fits:", time.time() - start)
