public class BattleEngine {
    public static int playerAttack(Movie movie, Enemy enemy) {
        int dmg = Math.max(1, movie.stats.atk - enemy.atk / 2);
        enemy.hp -= dmg;
        return dmg;
    }
}
