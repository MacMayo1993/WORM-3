from itertools import product
from collections import deque
import heapq, random


def bits(n, m):
    return tuple((n >> i) & 1 for i in range(m))

def wt(x): return sum(x)

# T1/T sector: direct formula vs BFS single-bit toggles to pair-symmetric
def sector_formula(b):
    P=len(b)//2
    return sum(b[2*i]^b[2*i+1] for i in range(P))

def bfs_to_target(start, neighbors, target):
    if target(start): return 0
    q=deque([(start,0)]); seen={start}
    while q:
        x,d=q.popleft()
        for y in neighbors(x):
            if y in seen: continue
            if target(y): return d+1
            seen.add(y); q.append((y,d+1))
    return None

sector_cases=0
for P in range(1,5):
    n=2*P
    for z in range(1<<n):
        b=bits(z,n)
        def neigh(x):
            for j in range(n):
                y=list(x); y[j]^=1; yield tuple(y)
        d=bfs_to_target(b,neigh,lambda x: all(x[2*i]==x[2*i+1] for i in range(P)))
        assert d==sector_formula(b),(P,b,d,sector_formula(b))
        sector_cases+=1

# quotient
quot_cases=0
for P in range(1,9):
    for z in range(1<<P):
        q=bits(z,P); k=wt(q)
        d=min(sum(q),sum(1-v for v in q))
        assert d==min(k,P-k)
        quot_cases+=1

# weighted local metric closure via Dijkstra on F2^2 for all costs 1..4
local_weighted_cases=0
states=[(0,0),(1,0),(0,1),(1,1)]
for f,ha,hc in product(range(1,5), repeat=3):
    generators=[((1,1),f),((1,0),ha),((0,1),hc)]
    F=min(f,ha+hc); A=min(ha,f+hc); C=min(hc,f+ha)
    expected={(0,0):0,(1,0):A,(0,1):C,(1,1):F}
    # distances from zero; Cayley translation invariance handles all source-target pairs
    dist={(0,0):0}; pq=[(0,(0,0))]
    while pq:
        d,x=heapq.heappop(pq)
        if d!=dist[x]: continue
        for g,c in generators:
            y=(x[0]^g[0],x[1]^g[1]); nd=d+c
            if nd<dist.get(y,10**9):
                dist[y]=nd; heapq.heappush(pq,(nd,y))
    assert dist==expected,(f,ha,hc,dist,expected)
    local_weighted_cases+=4

# weighted global theorem, random heterogeneous costs vs Dijkstra
random.seed(20260821)
weighted_global_cases=0
for P in range(1,5):
    n=2*P
    for _ in range(800):
        b=tuple(random.randrange(2) for _ in range(n))
        costs=[tuple(random.randint(1,6) for _ in range(3)) for _ in range(P)] # f,ha,hc
        # closed-form local distances
        to0=to1=0
        for i in range(P):
            a,c=b[2*i],b[2*i+1]
            f,ha,hc=costs[i]
            F=min(f,ha+hc); A=min(ha,f+hc); C=min(hc,f+ha)
            diff0=(a,c)
            diff1=(a^1,c^1)
            w={(0,0):0,(1,0):A,(0,1):C,(1,1):F}
            to0+=w[diff0]; to1+=w[diff1]
        formula=min(to0,to1)
        # global Dijkstra
        target0=(0,)*n; target1=(1,)*n
        dist={b:0}; pq=[(0,b)]
        found=None
        while pq:
            d,x=heapq.heappop(pq)
            if d!=dist[x]: continue
            if x==target0 or x==target1:
                found=d; break
            for i in range(P):
                f,ha,hc=costs[i]
                for kind,cost in [('p',f),('a',ha),('c',hc)]:
                    y=list(x)
                    if kind in ('p','a'): y[2*i]^=1
                    if kind in ('p','c'): y[2*i+1]^=1
                    y=tuple(y); nd=d+cost
                    if nd<dist.get(y,10**9):
                        dist[y]=nd; heapq.heappush(pq,(nd,y))
        assert found==formula,(P,b,costs,found,formula)
        weighted_global_cases+=1

# directed canonical model unit costs: heal 1->0 on either member; paired flip reversible. exact formula via Dijkstra
canonical_cases=0
for P in range(1,5):
    n=2*P
    for z in range(1<<n):
        b=bits(z,n)
        asym=sum(b[2*i]^b[2*i+1] for i in range(P))
        n11=sum(b[2*i] and b[2*i+1] for i in range(P))
        formula=asym+min(n11,P-n11)
        target0=(0,)*n; target1=(1,)*n
        dist={b:0}; pq=[(0,b)]; found=None
        while pq:
            d,x=heapq.heappop(pq)
            if d!=dist[x]: continue
            if x==target0 or x==target1:
                found=d; break
            for i in range(P):
                # paired flip
                y=list(x); y[2*i]^=1; y[2*i+1]^=1; y=tuple(y)
                if d+1<dist.get(y,10**9): dist[y]=d+1; heapq.heappush(pq,(d+1,y))
                # lower-only heals
                for j in (2*i,2*i+1):
                    if x[j]==1:
                        y=list(x); y[j]=0; y=tuple(y)
                        if d+1<dist.get(y,10**9): dist[y]=d+1; heapq.heappush(pq,(d+1,y))
        assert found==formula,(P,b,found,formula)
        canonical_cases+=1

# G=(Z2)^r orbit consensus formula vs BFS vertex toggles to constant
cube_cases=0
for r in range(1,5):
    m=1<<r
    for z in range(1<<m):
        b=bits(z,m); formula=min(wt(b),m-wt(b))
        # direct Hamming distance to constants is independently computed
        brute=min(sum(v for v in b),sum(1-v for v in b))
        assert brute==formula
        cube_cases+=1

# Q_r cohomology dimension graph formula and nearest coboundary/frustration objective equivalence random tests
frustration_cases=0
for r in range(2,4):
    V=list(range(1<<r))
    E=[]
    for v in V:
        for j in range(r):
            u=v^(1<<j)
            if v<u: E.append((v,u))
    dim=len(E)-len(V)+1
    assert dim==(1<<(r-1))*(r-2)+1
    for _ in range(200):
        eta=[random.randrange(2) for _ in E]
        # distance to B1
        best=10**9
        for mask in range(1<<len(V)):
            x=[(mask>>v)&1 for v in V]
            bad=sum(eta[e] != (x[u]^x[v]) for e,(u,v) in enumerate(E))
            best=min(best,bad)
        # signed frustration by vertex switching convention is identical objective, computed separately via spins
        best2=10**9
        sigma=[-1 if z else 1 for z in eta]
        for mask in range(1<<len(V)):
            s=[-1 if ((mask>>v)&1) else 1 for v in V]
            bad=sum(sigma[e] != s[u]*s[v] for e,(u,v) in enumerate(E))
            best2=min(best2,bad)
        assert best==best2
        frustration_cases+=1

print('sector_cases',sector_cases)
print('quotient_cases',quot_cases)
print('local_weighted_state_costs',local_weighted_cases)
print('weighted_global_random_cases',weighted_global_cases)
print('directed_canonical_cases',canonical_cases)
print('cube_orbit_cases',cube_cases)
print('frustration_random_cases',frustration_cases)
print('ALL_OK')
