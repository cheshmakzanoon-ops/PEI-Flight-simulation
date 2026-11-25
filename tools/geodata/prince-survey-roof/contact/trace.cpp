// Offline cosine-weighted visibility on an already frozen 98-triangle receiver.
// Input coordinates are local simulator metres. No new surface is inferred.
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

struct Point {
    double x, y, z;
    Point operator+(Point q) const { return {x + q.x, y + q.y, z + q.z}; }
    Point operator-(Point q) const { return {x - q.x, y - q.y, z - q.z}; }
    Point operator*(double a) const { return {x * a, y * a, z * a}; }
    double dot(Point q) const { return x * q.x + y * q.y + z * q.z; }
    Point cross(Point q) const {
        return {y * q.z - z * q.y, z * q.x - x * q.z, x * q.y - y * q.x};
    }
    Point unit() const { return *this * (1.0 / std::sqrt(dot(*this))); }
};
struct Triangle { Point a, ab, ac; };

// Two-sided ray/triangle hit up to the previous nearest distance.
double hit(Point origin, Point direction, const Triangle &t, double nearest) {
    const Point p = direction.cross(t.ac);
    const double den = t.ab.dot(p);
    if (std::abs(den) < 1e-10) return nearest;
    const double inv = 1.0 / den;
    const Point s = origin - t.a;
    const double u = s.dot(p) * inv;
    if (u < 0 || u > 1) return nearest;
    const Point q = s.cross(t.ab);
    const double v = direction.dot(q) * inv;
    if (v < 0 || u + v > 1) return nearest;
    const double distance = t.ac.dot(q) * inv;
    return distance > .02 && distance < nearest ? distance : nearest;
}

int main() {
    int count = 0;
    if (std::scanf("%d", &count) != 1 || count != 98) return 2;
    std::vector<Triangle> triangles;
    for (int i = 0; i < count; ++i) {
        int role;
        Point a, b, c;
        if (std::scanf("%d%lf%lf%lf%lf%lf%lf%lf%lf%lf", &role, &a.x, &a.y, &a.z,
                       &b.x, &b.y, &b.z, &c.x, &c.y, &c.z) != 10) return 2;
        if (role != 0 && role != 1) return 2;
        triangles.push_back({a, b - a, c - a});
    }
    constexpr int rays = 768;
    std::vector<Point> directions;
    for (int j = 0; j < rays; ++j) {
        const double r = std::sqrt((j + .5) / rays), azimuth = j * 2.399963229728653;
        directions.push_back({r * std::cos(azimuth), std::sqrt(1 - r * r),
                              r * std::sin(azimuth)});
    }
    auto *probes = std::fopen("chart-probes.txt", "r");
    if (!probes || std::fscanf(probes, "%d", &count) != 1 || count != 2198) return 2;
    for (int i = 0; i < count; ++i) {
        int receivingFace; Point p, n;
        if (std::fscanf(probes, "%d%lf%lf%lf%lf%lf%lf", &receivingFace,
                        &p.x, &p.y, &p.z, &n.x, &n.y, &n.z) != 7) return 2;
        if (receivingFace < 0 || receivingFace >= 98) return 2;
        const Point tangent = Point{0, 0, 1}.cross(n).unit();
        const Point bitangent = n.cross(tangent).unit();
        const Point origin = p + n * .013;
        double weighted = 0;
        for (Point h : directions) {
            const Point direction = tangent * h.x + n * h.y + bitangent * h.z;
            double nearest = 14.;
            for (int j = 0; j < 98; ++j) {
                if (j != receivingFace) nearest = hit(origin, direction, triangles[j], nearest);
            }
            if (nearest < 14.) {
                const double a = std::clamp((14. - nearest) / 9., 0., 1.);
                weighted += a * a * (3. - 2. * a);
            }
        }
        std::printf("%.7f\n", weighted / rays);
    }
    std::fclose(probes);
}
